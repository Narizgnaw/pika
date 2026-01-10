package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/dushixiang/pika/internal/models"
	"github.com/dushixiang/pika/internal/protocol"
	"github.com/dushixiang/pika/internal/repo"
	"github.com/dushixiang/pika/internal/websocket"

	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SSHLoginService SSH登录服务
type SSHLoginService struct {
	logger            *zap.Logger
	SSHLoginEventRepo *repo.SSHLoginEventRepo
	agentRepo         *repo.AgentRepo
	wsManager         *websocket.Manager
	geoIPSvc          *GeoIPService
}

// NewSSHLoginService 创建服务
func NewSSHLoginService(logger *zap.Logger, db *gorm.DB, wsManager *websocket.Manager, geoIPSvc *GeoIPService) *SSHLoginService {
	return &SSHLoginService{
		logger:            logger,
		SSHLoginEventRepo: repo.NewSSHLoginEventRepo(db),
		agentRepo:         repo.NewAgentRepo(db),
		wsManager:         wsManager,
		geoIPSvc:          geoIPSvc,
	}
}

// === 配置管理 ===

// GetConfig 获取探针的配置
func (s *SSHLoginService) GetConfig(ctx context.Context, agentID string) (*models.SSHLoginConfigData, error) {
	agent, err := s.agentRepo.FindById(ctx, agentID)
	if err != nil {
		return nil, err
	}
	config := agent.SSHLoginConfig.Data()
	return &config, nil
}

// UpdateConfig 更新配置并下发到 Agent
// 返回: config - 配置对象, error - 错误信息
func (s *SSHLoginService) UpdateConfig(ctx context.Context, agentID string, enabled bool) error {
	// 保存配置到数据库
	config := models.SSHLoginConfigData{
		Enabled: enabled,
	}

	var agentForUpdate = models.Agent{
		ID:             agentID,
		SSHLoginConfig: datatypes.NewJSONType(config),
	}
	if err := s.agentRepo.UpdateById(ctx, &agentForUpdate); err != nil {
		return err
	}

	// 下发配置到 Agent
	return s.sendConfigToAgent(agentID, enabled)
}

// sendConfigToAgent 下发配置到 Agent
func (s *SSHLoginService) sendConfigToAgent(agentID string, enabled bool) error {
	configData := protocol.SSHLoginConfig{
		Enabled: enabled,
	}

	message := protocol.OutboundMessage{
		Type: protocol.MessageTypeSSHLoginConfig,
		Data: configData,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("序列化消息失败: %w", err)
	}

	return s.wsManager.SendToClient(agentID, msgBytes)
}

// HandleConfigResult 处理 Agent 上报的配置应用结果
func (s *SSHLoginService) HandleConfigResult(ctx context.Context, agentID string, result protocol.SSHLoginConfigResult) error {
	// 获取现有配置
	config, err := s.GetConfig(ctx, agentID)
	if err != nil {
		return fmt.Errorf("获取配置失败: %w", err)
	}

	// 更新配置应用状态
	status := "success"
	if !result.Success {
		status = "failed"
	}

	config.ApplyStatus = status
	config.ApplyMessage = result.Message

	var agentForUpdate = models.Agent{
		ID:             agentID,
		SSHLoginConfig: datatypes.NewJSONType(*config),
	}
	return s.agentRepo.UpdateById(ctx, &agentForUpdate)
}

// === 事件处理 ===

// HandleEvent 处理 Agent 上报的事件
func (s *SSHLoginService) HandleEvent(ctx context.Context, agentID string, eventData protocol.SSHLoginEvent) error {
	// 检查是否启用监控
	config, err := s.GetConfig(ctx, agentID)
	if err != nil {
		return err
	}

	// 如果未启用，忽略事件
	if config == nil || !config.Enabled {
		s.logger.Debug("SSH登录监控未启用，忽略事件", zap.String("agentId", agentID))
		return nil
	}

	// 保存事件到数据库
	event := &models.SSHLoginEvent{
		AgentID:   agentID,
		Username:  eventData.Username,
		IP:        eventData.IP,
		Port:      eventData.Port,
		Status:    eventData.Status,
		Method:    eventData.Method,
		TTY:       eventData.TTY,
		SessionID: eventData.SessionID,
		Timestamp: eventData.Timestamp,
		CreatedAt: time.Now().UnixMilli(),
	}

	if err := s.SSHLoginEventRepo.Create(ctx, event); err != nil {
		s.logger.Error("保存SSH登录事件失败", zap.Error(err))
		return err
	}

	s.logger.Info("SSH登录事件已记录",
		zap.String("agentId", agentID),
		zap.String("username", eventData.Username),
		zap.String("ip", eventData.IP),
		zap.String("status", eventData.Status))

	return nil
}

// === 事件查询 ===

// DeleteEventsByAgentID 删除探针的所有事件
func (s *SSHLoginService) DeleteEventsByAgentID(ctx context.Context, agentID string) error {
	return s.SSHLoginEventRepo.DeleteEventsByAgentID(ctx, agentID)
}
