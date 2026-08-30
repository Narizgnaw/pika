package websocket

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pika-monitor/pika/internal/protocol"
	"go.uber.org/zap"
)

const (
	serverPingInterval = 10 * time.Second
	serverPongWait     = 30 * time.Second
	serverWriteWait    = 10 * time.Second

	// agentQueueSize 每个探针的待处理消息队列长度。队列满时断开连接，
	// 由探针重连后重放未确认消息，读循环不会被慢处理（DB/VM 写入）拖死。
	agentQueueSize = 512
	// agentQueueWait 消息入队的最长等待，超时判定为处理能力不足
	agentQueueWait = 2 * time.Second
	// serverSendWait 下行消息写入 Send 通道的最长等待
	serverSendWait = 3 * time.Second
)

// agentMessage 从探针收到的一条待处理消息
type agentMessage struct {
	seq  uint64
	typ  string
	data json.RawMessage
}

// processor 单个探针连接的有序处理单元：ReadPump 只负责解析并入队，
// processLoop 串行消费，慢处理不再阻塞 TCP 读取造成反压。
type processor struct {
	queue    chan agentMessage
	quit     chan struct{}
	quitOnce sync.Once
}

func newProcessor() *processor {
	return &processor{
		queue: make(chan agentMessage, agentQueueSize),
		quit:  make(chan struct{}),
	}
}

func (p *processor) stop() {
	p.quitOnce.Do(func() { close(p.quit) })
}

// Client WebSocket客户端
type Client struct {
	ID         string          // 探针ID
	Conn       *websocket.Conn // WebSocket连接
	Send       chan []byte     // 发送消息通道
	Manager    *Manager        // 管理器引用
	LastActive time.Time       // 最后活跃时间
	proc       *processor      // 上行消息的有序处理器
	// lastStatusWrite 上次把在线状态写入数据库的时间（毫秒），用于
	// 对 pong 触发的状态更新去抖
	lastStatusWrite atomic.Int64
	closed          bool // 标记channel是否已关闭
	closeMu         sync.Mutex
}

// Manager WebSocket连接管理器
type Manager struct {
	clients    map[string]*Client // 客户端映射 probeID -> Client
	register   chan *Client       // 注册通道
	unregister chan *Client       // 注销通道
	broadcast  chan []byte        // 广播通道
	mu         sync.RWMutex       // 读写锁
	logger     *zap.Logger        // 日志
	onMessage  MessageHandler     // 消息处理器
	onPong     PongHandler        // Pong 处理器
	// ackSeqs 每个探针事件流的累计确认位点（探针重启或服务端重启后
	// 丢失，退化为重放+去重，可能产生少量重复处理）
	ackSeqs map[string]uint64
	// sessions 每个探针最近一次注册携带的 BootID，用于识别探针进程重启
	sessions map[string]string
}

// MessageHandler 消息处理器接口
type MessageHandler func(ctx context.Context, probeID string, messageType string, data json.RawMessage) error

// PongHandler Pong 处理器接口
type PongHandler func(client *Client)

// NewManager 创建新的WebSocket管理器
func NewManager(logger *zap.Logger) *Manager {
	return &Manager{
		clients:    make(map[string]*Client),
		register:   make(chan *Client, 10),
		unregister: make(chan *Client, 10),
		broadcast:  make(chan []byte, 256),
		ackSeqs:    make(map[string]uint64),
		sessions:   make(map[string]string),
		logger:     logger,
	}
}

// SetMessageHandler 设置消息处理器
func (m *Manager) SetMessageHandler(handler MessageHandler) {
	m.onMessage = handler
}

// SetPongHandler 设置 Pong 处理器
func (m *Manager) SetPongHandler(handler PongHandler) {
	m.onPong = handler
}

// Run 启动管理器
func (m *Manager) Run(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			m.logger.Info("websocket manager stopped")
			return
		case client := <-m.register:
			m.registerClient(client)
		case client := <-m.unregister:
			m.unregisterClient(client)
		case message := <-m.broadcast:
			m.broadcastMessage(message)
		case <-ticker.C:
			m.checkInactiveClients()
		}
	}
}

// Register 注册客户端（公开方法）。同步初始化处理器，确保随后的
// ReadPump 可以立即入队；注册表维护仍走 Run 循环的注册通道。
func (m *Manager) Register(client *Client) {
	client.proc = newProcessor()
	go m.processLoop(client)
	m.register <- client
}

// registerClient 注册客户端
func (m *Manager) registerClient(client *Client) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 如果已存在该探针的连接，先关闭旧连接
	if oldClient, exists := m.clients[client.ID]; exists && oldClient != client {
		m.logger.Info("agent reconnected, closing old connection", zap.String("agentID", client.ID))
		oldClient.closeChannel()
		oldClient.Conn.Close()
		oldClient.stopProcessor()
	}

	m.clients[client.ID] = client
	m.logger.Info("agent connected", zap.String("agentID", client.ID), zap.Int("totalClients", len(m.clients)))
}

// unregisterClient 注销客户端
func (m *Manager) unregisterClient(client *Client) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 只注销当前注册的连接：探针快速重连时旧连接的退出路径不能把
	// 新连接从注册表中移除，否则新连接的下行通道会被关闭
	if cur, exists := m.clients[client.ID]; exists && cur == client {
		delete(m.clients, client.ID)
		client.closeChannel()
		m.logger.Info("agent disconnected", zap.String("agentID", client.ID), zap.Int("totalClients", len(m.clients)))
	}
	client.stopProcessor()
}

// broadcastMessage 广播消息
func (m *Manager) broadcastMessage(message []byte) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, client := range m.clients {
		select {
		case client.Send <- message:
		default:
			// 发送失败，客户端可能已断开
			m.logger.Warn("failed to send message, client may be disconnected", zap.String("agentID", client.ID))
		}
	}
}

// checkInactiveClients 检查不活跃的客户端
func (m *Manager) checkInactiveClients() {
	m.mu.RLock()
	inactiveClients := make([]*Client, 0)
	timeout := 2 * time.Minute

	for _, client := range m.clients {
		if time.Since(client.LastActive) > timeout {
			inactiveClients = append(inactiveClients, client)
		}
	}
	m.mu.RUnlock()

	// 断开不活跃的客户端
	for _, client := range inactiveClients {
		// 再次检查客户端是否仍然存在（避免竞态条件）
		m.mu.RLock()
		cur, exists := m.clients[client.ID]
		m.mu.RUnlock()

		if exists && cur == client {
			m.logger.Warn("agent inactive timeout, disconnecting", zap.String("agentID", client.ID))
			client.Conn.Close()
			m.unregister <- client
		}
	}
}

// SendToClient 发送消息给指定客户端。通道满时最多等待 serverSendWait，
// 避免高负载时指令/配置被静默丢弃
func (m *Manager) SendToClient(probeID string, message []byte) error {
	m.mu.RLock()
	client, exists := m.clients[probeID]
	m.mu.RUnlock()

	if !exists {
		return ErrClientNotFound
	}

	select {
	case client.Send <- message:
		return nil
	case <-time.After(serverSendWait):
		return ErrSendTimeout
	}
}

// GetClient 获取客户端
func (m *Manager) GetClient(probeID string) (*Client, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	client, exists := m.clients[probeID]
	return client, exists
}

// GetAllClients 获取所有客户端ID
func (m *Manager) GetAllClients() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]string, 0, len(m.clients))
	for id := range m.clients {
		ids = append(ids, id)
	}
	return ids
}

// ClientCount 获取客户端数量
func (m *Manager) ClientCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.clients)
}

// AckSeq 返回探针事件流的累计确认位点。注册响应携带该值，探针据此
// 跳过服务端已处理的消息，避免无谓重放。
func (m *Manager) AckSeq(probeID string) uint64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.ackSeqs[probeID]
}

// BeginAgentSession 在注册时同步探针会话：BootID 变化说明探针进程
// 重启过（纯内存事件队列清空、seq 从 1 重新分配），必须重置确认位点，
// 否则重启后新分配的小序号会被旧位点误判为重复消息而丢弃。
// 旧版探针不携带 BootID，保持原位点不变。
func (m *Manager) BeginAgentSession(probeID, bootID string) {
	if bootID == "" {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.sessions[probeID] != bootID {
		m.sessions[probeID] = bootID
		m.ackSeqs[probeID] = 0
	}
}

// advanceAckSeq 推进探针的累计确认位点（只前进不回退）
func (m *Manager) advanceAckSeq(probeID string, seq uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.ackSeqs[probeID] < seq {
		m.ackSeqs[probeID] = seq
	}
}

// ReadPump 读取客户端消息。只做解析和入队，处理在 processLoop 中进行，
// 保证慢处理不会阻塞读取造成 TCP 反压。
func (c *Client) ReadPump(ctx context.Context) {
	defer func() {
		c.Manager.unregister <- c
		c.Conn.Close()
		c.stopProcessor()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(serverPongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(serverPongWait))
		c.LastActive = time.Now()
		if c.Manager.onPong != nil {
			go c.Manager.onPong(c)
		}
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.Manager.logger.Error("websocket read error", zap.Error(err), zap.String("agentID", c.ID))
			}
			return
		}

		c.LastActive = time.Now()

		// 解析消息
		var msg protocol.InputMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			c.Manager.logger.Error("failed to parse message", zap.Error(err), zap.String("agentID", c.ID))
			continue
		}

		if err := c.enqueue(agentMessage{seq: msg.Seq, typ: string(msg.Type), data: msg.Data}); err != nil {
			c.Manager.logger.Warn("agent processing queue stalled, disconnecting for replay",
				zap.String("agentID", c.ID), zap.Error(err))
			return
		}
	}
}

// enqueue 将消息放入该连接的有序处理队列。队列满时最多等待
// agentQueueWait，仍无法入队则返回错误，由调用方断开连接触发探针重放。
func (c *Client) enqueue(msg agentMessage) error {
	// 先检查处理器是否已停止：select 各分支同时就绪时是随机选择，
	// 不前置检查会导致停止后的消息仍被入队却永远无人消费
	select {
	case <-c.proc.quit:
		return ErrProcessorStopped
	default:
	}

	select {
	case c.proc.queue <- msg:
		return nil
	case <-time.After(agentQueueWait):
		return ErrQueueFull
	case <-c.proc.quit:
		return ErrProcessorStopped
	}
}

// stopProcessor 停止该连接的处理器
func (c *Client) stopProcessor() {
	if c.proc != nil {
		c.proc.stop()
	}
}

// processLoop 串行处理单个探针的消息，保证 per-agent 顺序。
// 带 seq 的消息处理成功后推进确认位点并回累计 ack；重放消息按
// 确认位点去重。处理失败按丢弃处理并记录（与旧行为一致），避免
// 毒消息卡死整个事件流。
func (m *Manager) processLoop(c *Client) {
	for {
		select {
		case msg := <-c.proc.queue:
			if msg.seq > 0 && msg.seq <= m.AckSeq(c.ID) {
				// 重放去重：该消息已处理过。仍回 ack（当前确认位点
				// 不低于该 seq），让探针能修剪队列
				m.sendAck(c, m.AckSeq(c.ID))
				continue
			}

			if m.onMessage != nil {
				if err := m.onMessage(context.Background(), c.ID, msg.typ, msg.data); err != nil {
					m.logger.Error("failed to handle message, dropped",
						zap.Error(err), zap.String("agentID", c.ID),
						zap.String("type", msg.typ), zap.Uint64("seq", msg.seq))
				}
			}

			if msg.seq > 0 {
				m.advanceAckSeq(c.ID, msg.seq)
				m.sendAck(c, msg.seq)
			}

		case <-c.proc.quit:
			return
		}
	}
}

// sendAck 向探针发送累计确认。走下行 Send 通道，满时丢弃：丢失的
// ack 只会让探针多保留一会儿消息，重连重放时按 seq 去重，无副作用。
func (m *Manager) sendAck(c *Client, seq uint64) {
	payload, err := json.Marshal(protocol.OutboundMessage{
		Type: protocol.MessageTypeAck,
		Data: protocol.AckData{Seq: seq},
	})
	if err != nil {
		return
	}
	select {
	case c.Send <- payload:
	default:
	}
}

// WritePump 向客户端写入消息
func (c *Client) WritePump() {
	ticker := time.NewTicker(serverPingInterval)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(serverWriteWait))
			if !ok {
				// 通道已关闭
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				c.Manager.logger.Error("failed to write message", zap.Error(err), zap.String("agentID", c.ID))
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(serverWriteWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ShouldWriteStatus 报告是否需要把在线状态写入数据库。去抖：本连接
// 首次调用立即通过，之后每 refreshInterval 通过一次。
func (c *Client) ShouldWriteStatus(refreshInterval time.Duration) bool {
	now := time.Now().UnixMilli()
	last := c.lastStatusWrite.Load()
	return last == 0 || now-last >= refreshInterval.Milliseconds()
}

// MarkStatusWritten 记录本次在线状态已成功写库
func (c *Client) MarkStatusWritten() {
	c.lastStatusWrite.Store(time.Now().UnixMilli())
}

// closeChannel 安全地关闭发送通道
func (c *Client) closeChannel() {
	c.closeMu.Lock()
	defer c.closeMu.Unlock()

	if !c.closed {
		close(c.Send)
		c.closed = true
	}
}

// 错误定义
var (
	ErrClientNotFound   = &websocket.CloseError{Code: 1000, Text: "client not found"}
	ErrSendTimeout      = &websocket.CloseError{Code: 1001, Text: "send timeout"}
	ErrQueueFull        = &websocket.CloseError{Code: 1013, Text: "processing queue full"}
	ErrProcessorStopped = &websocket.CloseError{Code: 1000, Text: "processor stopped"}
)
