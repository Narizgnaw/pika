package sshmonitor

// SSHLoginEvent SSH登录事件（内部结构）
type SSHLoginEvent struct {
	Username  string `json:"username"`
	IP        string `json:"ip"`
	Port      string `json:"port,omitempty"`
	Timestamp int64  `json:"timestamp"`
	Status    string `json:"status"`
	Method    string `json:"method,omitempty"`
	TTY       string `json:"tty,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
}
