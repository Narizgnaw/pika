package service

import (
	"testing"

	"github.com/pika-monitor/pika/internal/protocol"
)

func TestOutboxSeqAssignment(t *testing.T) {
	o := newOutbox()
	for i := 1; i <= 3; i++ {
		seq := o.enqueue(protocol.OutboundMessage{Type: protocol.MessageTypeSSHLoginEvent})
		if seq != uint64(i) {
			t.Fatalf("enqueue #%d got seq %d", i, seq)
		}
	}

	msgs := o.after(0)
	if len(msgs) != 3 {
		t.Fatalf("after(0) returned %d messages, want 3", len(msgs))
	}
	for i, msg := range msgs {
		if msg.Seq != uint64(i+1) {
			t.Fatalf("msgs[%d].Seq = %d, want %d", i, msg.Seq, i+1)
		}
	}
}

func TestOutboxAckTrimsPrefix(t *testing.T) {
	o := newOutbox()
	for i := 0; i < 5; i++ {
		o.enqueue(protocol.OutboundMessage{Type: protocol.MessageTypeTamperEvent})
	}

	if trimmed := o.ack(3); trimmed != 3 {
		t.Fatalf("ack(3) trimmed %d, want 3", trimmed)
	}
	if pending, acked, _ := o.stats(); pending != 2 || acked != 3 {
		t.Fatalf("after ack(3): pending=%d acked=%d, want pending=2 acked=3", pending, acked)
	}

	// 重复/回退的 ack 无效
	if trimmed := o.ack(2); trimmed != 0 {
		t.Fatalf("stale ack(2) trimmed %d, want 0", trimmed)
	}

	// 剩余消息 seq 保持原值，重放判定不受修剪影响
	msgs := o.after(0)
	if len(msgs) != 2 || msgs[0].Seq != 4 || msgs[1].Seq != 5 {
		t.Fatalf("remaining messages = %+v, want seq 4,5", msgs)
	}
}

func TestOutboxAfterSkipsSent(t *testing.T) {
	o := newOutbox()
	for i := 0; i < 4; i++ {
		o.enqueue(protocol.OutboundMessage{Type: protocol.MessageTypeCommandResp})
	}

	msgs := o.after(2)
	if len(msgs) != 2 || msgs[0].Seq != 3 || msgs[1].Seq != 4 {
		t.Fatalf("after(2) = %+v, want seq 3,4", msgs)
	}

	// 全部已发送时返回空
	if msgs := o.after(4); len(msgs) != 0 {
		t.Fatalf("after(4) = %+v, want empty", msgs)
	}
}

func TestOutboxOverflowDropsOldest(t *testing.T) {
	o := newOutbox()
	for i := 0; i < outboxMaxEntries+50; i++ {
		o.enqueue(protocol.OutboundMessage{Type: protocol.MessageTypeTamperEvent})
	}

	pending, _, dropped := o.stats()
	if pending != outboxMaxEntries {
		t.Fatalf("pending = %d, want %d", pending, outboxMaxEntries)
	}
	if dropped != 50 {
		t.Fatalf("dropped = %d, want 50", dropped)
	}

	// 队列保留的是最新的消息
	msgs := o.after(0)
	first := uint64(outboxMaxEntries + 50 - outboxMaxEntries + 1)
	if len(msgs) != outboxMaxEntries || msgs[0].Seq != first {
		t.Fatalf("oldest retained seq = %d, want %d", msgs[0].Seq, first)
	}
}

func TestOutboxEnqueueSetsMsgSeq(t *testing.T) {
	o := newOutbox()
	msg := protocol.OutboundMessage{Type: protocol.MessageTypeCommandResp}
	o.enqueue(msg)

	// enqueue 内部复制赋值，入队消息带 seq
	if msg.Seq != 0 {
		t.Fatalf("caller message mutated, seq = %d", msg.Seq)
	}
	stored := o.after(0)
	if len(stored) != 1 || stored[0].Seq != 1 {
		t.Fatalf("stored = %+v, want one message with seq 1", stored)
	}
}
