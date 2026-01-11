package service

import (
	"context"

	"github.com/dushixiang/pika/internal/models"
	"go.uber.org/zap"
)

const (
	NotificationTypeTraffic   = "traffic"
	NotificationTypeSSHLogin  = "ssh_login"
	NotificationTypeTamperEvt = "tamper"
)

// NotificationService 统一通知发送入口
type NotificationService struct {
	logger          *zap.Logger
	propertyService *PropertyService
	notifier        *Notifier
}

func NewNotificationService(logger *zap.Logger, propertyService *PropertyService, notifier *Notifier) *NotificationService {
	return &NotificationService{
		logger:          logger,
		propertyService: propertyService,
		notifier:        notifier,
	}
}

// SendAlertNotification 根据配置发送通知
func (s *NotificationService) SendAlertNotification(ctx context.Context, notificationType string, record *models.AlertRecord, agent *models.Agent) error {
	alertConfig, err := s.propertyService.GetAlertConfig(ctx)
	if err != nil {
		return err
	}

	if !alertConfig.Enabled {
		return nil
	}

	if !isNotificationEnabled(alertConfig, notificationType) {
		return nil
	}

	channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(ctx)
	if err != nil {
		return err
	}

	var enabledChannels []models.NotificationChannelConfig
	for _, channel := range channelConfigs {
		if channel.Enabled {
			enabledChannels = append(enabledChannels, channel)
		}
	}

	if len(enabledChannels) == 0 {
		return nil
	}

	if err := s.notifier.SendNotificationByConfigs(ctx, enabledChannels, record, agent, alertConfig.MaskIP); err != nil {
		s.logger.Error("发送通知失败", zap.Error(err))
		return err
	}

	return nil
}

func (s *NotificationService) IsMaskIPEnabled(ctx context.Context) (bool, error) {
	alertConfig, err := s.propertyService.GetAlertConfig(ctx)
	if err != nil {
		return false, err
	}
	return alertConfig.MaskIP, nil
}

func isNotificationEnabled(config *models.AlertConfig, notificationType string) bool {
	switch notificationType {
	case NotificationTypeTraffic:
		return config.Notifications.TrafficEnabled
	case NotificationTypeSSHLogin:
		return config.Notifications.SSHLoginSuccessEnabled
	case NotificationTypeTamperEvt:
		return config.Notifications.TamperEventEnabled
	default:
		return true
	}
}
