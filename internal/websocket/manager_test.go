package websocket

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/pika-monitor/pika/internal/protocol"
	"go.uber.org/zap"
)

func newTestClient(m *Manager, id string) *Client {
	c := &Client{
		ID:      id,
		Send:    make(chan []byte, 16),
		Manager: m,
	}
	c.proc = newProcessor()
	return c
}

func readAck(t *testing.T, c *Client) uint64 {
	t.Helper()
	select {
	case raw := <-c.Send:
		var msg protocol.InputMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("unmarshal ack: %v", err)
		}
		if msg.Type != protocol.MessageTypeAck {
			t.Fatalf("expected ack message, got %s", msg.Type)
		}
		var ack protocol.AckData
		if err := json.Unmarshal(msg.Data, &ack); err != nil {
			t.Fatalf("unmarshal ack data: %v", err)
		}
		return ack.Seq
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for ack")
		return 0
	}
}

func TestProcessLoopDedupAckAndOrder(t *testing.T) {
	m := NewManager(zap.NewNop())
	var processed []string
	done := make(chan struct{})
	m.SetMessageHandler(func(ctx context.Context, probeID, typ string, data json.RawMessage) error {
		processed = append(processed, typ)
		if len(processed) == 2 {
			close(done)
		}
		return nil
	})

	client := newTestClient(m, "agent-1")
	go m.processLoop(client)
	defer client.stopProcessor()

	// 模拟断线前的确认位点：seq 1 已处理
	m.advanceAckSeq("agent-1", 1)

	// seq 1 是重放（应去重跳过），seq 2、3 是新消息（按序处理）
	client.proc.queue <- agentMessage{seq: 1, typ: "replayed"}
	client.proc.queue <- agentMessage{seq: 2, typ: "first"}
	client.proc.queue <- agentMessage{seq: 3, typ: "second"}

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for processing")
	}

	if len(processed) != 2 || processed[0] != "first" || processed[1] != "second" {
		t.Fatalf("processed = %v, want [first second]", processed)
	}
	if got := m.AckSeq("agent-1"); got != 3 {
		t.Fatalf("AckSeq = %d, want 3", got)
	}

	// 去重跳过的消息也回 ack（位点 1），随后是新消息的 ack（2、3）
	if seq := readAck(t, client); seq != 1 {
		t.Fatalf("ack for replayed message = %d, want 1", seq)
	}
	if seq := readAck(t, client); seq != 2 {
		t.Fatalf("ack for first message = %d, want 2", seq)
	}
	if seq := readAck(t, client); seq != 3 {
		t.Fatalf("ack for second message = %d, want 3", seq)
	}
}

func TestProcessLoopSeqZeroBypassesAck(t *testing.T) {
	m := NewManager(zap.NewNop())
	handled := make(chan string, 1)
	m.SetMessageHandler(func(ctx context.Context, probeID, typ string, data json.RawMessage) error {
		handled <- typ
		return nil
	})

	client := newTestClient(m, "agent-2")
	go m.processLoop(client)
	defer client.stopProcessor()

	// seq=0 表示不参与可靠投递（如常规指标消息）：正常处理但不 ack
	client.proc.queue <- agentMessage{seq: 0, typ: "metrics"}

	select {
	case typ := <-handled:
		if typ != "metrics" {
			t.Fatalf("handled = %s, want metrics", typ)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for processing")
	}

	select {
	case raw := <-client.Send:
		t.Fatalf("seq=0 message should not be acked, got %s", raw)
	default:
	}
}

func TestAdvanceAckSeqMonotonic(t *testing.T) {
	m := NewManager(zap.NewNop())
	m.advanceAckSeq("a", 5)
	m.advanceAckSeq("a", 3) // 回退无效
	if got := m.AckSeq("a"); got != 5 {
		t.Fatalf("AckSeq = %d, want 5", got)
	}
	if got := m.AckSeq("missing"); got != 0 {
		t.Fatalf("AckSeq(missing) = %d, want 0", got)
	}
}

func TestBeginAgentSessionResetsAckSeqOnReboot(t *testing.T) {
	m := NewManager(zap.NewNop())

	// 探针运行期间位点推进
	m.BeginAgentSession("a", "boot-1")
	m.advanceAckSeq("a", 5000)

	// 同一进程重连：位点保留，重放去重继续有效
	m.BeginAgentSession("a", "boot-1")
	if got := m.AckSeq("a"); got != 5000 {
		t.Fatalf("AckSeq after reconnect = %d, want 5000", got)
	}

	// 探针重启（新 BootID，内存队列清空、seq 从 1 重新分配）：
	// 位点必须重置，否则重启后的小序号会被误判为重复消息丢弃
	m.BeginAgentSession("a", "boot-2")
	if got := m.AckSeq("a"); got != 0 {
		t.Fatalf("AckSeq after reboot = %d, want 0", got)
	}

	// 旧版探针不携带 BootID：不影响现有位点
	m.advanceAckSeq("a", 7)
	m.BeginAgentSession("a", "")
	if got := m.AckSeq("a"); got != 7 {
		t.Fatalf("AckSeq after legacy register = %d, want 7", got)
	}
}

func TestEnqueueReturnsAfterProcessorStop(t *testing.T) {
	m := NewManager(zap.NewNop())
	client := newTestClient(m, "agent-3")
	client.stopProcessor()

	if err := client.enqueue(agentMessage{seq: 1, typ: "x"}); err != ErrProcessorStopped {
		t.Fatalf("enqueue after stop = %v, want ErrProcessorStopped", err)
	}
}

func TestClientShouldWriteStatusDebounce(t *testing.T) {
	m := NewManager(zap.NewNop())
	client := newTestClient(m, "agent-4")

	if !client.ShouldWriteStatus(time.Minute) {
		t.Fatal("first check should pass")
	}
	client.MarkStatusWritten()
	if client.ShouldWriteStatus(time.Minute) {
		t.Fatal("second check within interval should be debounced")
	}
	if !client.ShouldWriteStatus(0) {
		t.Fatal("zero interval should always pass")
	}
}
