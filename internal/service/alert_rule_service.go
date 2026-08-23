package service

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/go-orz/orz"
	"github.com/google/uuid"
	"github.com/pika-monitor/pika/internal/models"
	"github.com/pika-monitor/pika/internal/repo"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// DefaultAlertRuleName 默认规则名称（首次启动/升级时从全局告警配置生成的规则）
const DefaultAlertRuleName = "默认规则"

// EffectiveAlertConfig 主机实际生效的告警配置（按优先级命中的第一条启用的告警规则）
type EffectiveAlertConfig struct {
	ConfigID      string                    // 告警规则 ID
	Name          string                    // 规则名称
	MaskIP        bool                      // 通知中是否打码 IP
	Notifications models.AlertNotifications // 事件通知开关（流量/SSH登录/防篡改）
	Rules         models.AlertRules         // 告警规则
	Channels      []string                  // 通知渠道类型列表（空 = 所有启用渠道）
}

type AlertRuleService struct {
	logger *zap.Logger
	*repo.AlertRuleRepo
	*orz.Service
	propertyService *PropertyService
	agentRepo       *repo.AgentRepo
	alertStateRepo  *repo.AlertStateRepo
	alertRecordRepo *repo.AlertRecordRepo
}

func NewAlertRuleService(logger *zap.Logger, db *gorm.DB, propertyService *PropertyService) *AlertRuleService {
	return &AlertRuleService{
		logger:          logger,
		AlertRuleRepo:   repo.NewAlertRuleRepo(db),
		Service:         orz.NewService(db),
		propertyService: propertyService,
		agentRepo:       repo.NewAgentRepo(db),
		alertStateRepo:  repo.NewAlertStateRepo(db),
		alertRecordRepo: repo.NewAlertRecordRepo(db),
	}
}

type AlertRuleRequest struct {
	Name          string                    `json:"name"`
	Priority      int                       `json:"priority"`
	Enabled       bool                      `json:"enabled"`
	TargetType    string                    `json:"targetType"`
	AgentIds      []string                  `json:"agentIds"`
	Tags          []string                  `json:"tags"`
	Rules         models.AlertRules         `json:"rules"`
	Channels      []string                  `json:"channels"`
	MaskIP        bool                      `json:"maskIP"`
	Notifications models.AlertNotifications `json:"notifications"`
}

func (s *AlertRuleService) CreateRule(ctx context.Context, req *AlertRuleRequest) (*models.AlertRule, error) {
	if err := s.normalizeRuleRequest(req); err != nil {
		return nil, err
	}

	rule := &models.AlertRule{
		ID:            uuid.NewString(),
		Name:          strings.TrimSpace(req.Name),
		Priority:      req.Priority,
		Enabled:       req.Enabled,
		TargetType:    req.TargetType,
		AgentIds:      datatypes.JSONSlice[string](req.AgentIds),
		Tags:          datatypes.JSONSlice[string](req.Tags),
		Rules:         datatypes.NewJSONType(req.Rules),
		Channels:      datatypes.JSONSlice[string](req.Channels),
		MaskIP:        req.MaskIP,
		Notifications: datatypes.NewJSONType(req.Notifications),
	}

	if err := s.AlertRuleRepo.Create(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *AlertRuleService) UpdateRule(ctx context.Context, id string, req *AlertRuleRequest) (*models.AlertRule, error) {
	if err := s.normalizeRuleRequest(req); err != nil {
		return nil, err
	}

	rule, err := s.AlertRuleRepo.FindById(ctx, id)
	if err != nil {
		return nil, err
	}

	rule.Name = strings.TrimSpace(req.Name)
	rule.Priority = req.Priority
	rule.Enabled = req.Enabled
	rule.TargetType = req.TargetType
	rule.AgentIds = req.AgentIds
	rule.Tags = req.Tags
	rule.Rules = datatypes.NewJSONType(req.Rules)
	rule.Channels = req.Channels
	rule.MaskIP = req.MaskIP
	rule.Notifications = datatypes.NewJSONType(req.Notifications)

	if err := s.AlertRuleRepo.Save(ctx, &rule); err != nil {
		return nil, err
	}

	// 规则变更后清理其下所有告警状态（阈值/持续时间等已变化，重新累计）
	s.cleanupStates(ctx, id, nil)

	return &rule, nil
}

func (s *AlertRuleService) DeleteRule(ctx context.Context, id string) error {
	if _, err := s.AlertRuleRepo.FindById(ctx, id); err != nil {
		return err
	}

	if err := s.AlertRuleRepo.DeleteById(ctx, id); err != nil {
		return err
	}

	// 清理该规则下所有主机的告警状态
	s.cleanupStates(ctx, id, nil)
	return nil
}

// UpdateRuleEnabled 更新规则启用状态（停用时其下主机不再命中该规则，清理告警状态）
func (s *AlertRuleService) UpdateRuleEnabled(ctx context.Context, id string, enabled bool) error {
	rule, err := s.AlertRuleRepo.FindById(ctx, id)
	if err != nil {
		return err
	}

	if rule.Enabled == enabled {
		return nil
	}

	rule.Enabled = enabled
	if err := s.AlertRuleRepo.Save(ctx, &rule); err != nil {
		return err
	}

	if !enabled {
		s.cleanupStates(ctx, id, nil)
	}
	return nil
}

// SeedDefaultRule 不存在任何告警规则时，从全局告警配置生成一条默认规则（覆盖全部主机）
func (s *AlertRuleService) SeedDefaultRule(ctx context.Context) error {
	count, err := s.AlertRuleRepo.Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	alertConfig, err := s.propertyService.GetAlertConfig(ctx)
	if err != nil {
		return err
	}

	rule := &models.AlertRule{
		ID:            uuid.NewString(),
		Name:          DefaultAlertRuleName,
		Priority:      100,
		Enabled:       true,
		TargetType:    models.AlertRuleTargetAll,
		Rules:         datatypes.NewJSONType(alertConfig.Rules),
		MaskIP:        alertConfig.MaskIP,
		Notifications: datatypes.NewJSONType(alertConfig.Notifications),
	}

	if err := s.AlertRuleRepo.Create(ctx, rule); err != nil {
		return err
	}

	s.logger.Info("已从全局告警配置生成默认告警规则", zap.String("ruleID", rule.ID))
	return nil
}

// ResolveForAgent 解析主机实际生效的告警配置：
// 启用的规则按优先级升序取第一条命中的规则；未命中任何规则时返回 nil（该主机不产生告警）。
func (s *AlertRuleService) ResolveForAgent(ctx context.Context, agentID string) (*EffectiveAlertConfig, error) {
	configs, err := s.ResolveForAgents(ctx, []string{agentID})
	if err != nil {
		return nil, err
	}
	return configs[agentID], nil
}

// ResolveForAgents 批量解析主机实际生效的告警配置（返回的 map 中不含未命中任何规则的主机）
func (s *AlertRuleService) ResolveForAgents(ctx context.Context, agentIDs []string) (map[string]*EffectiveAlertConfig, error) {
	result := make(map[string]*EffectiveAlertConfig, len(agentIDs))
	if len(agentIDs) == 0 {
		return result, nil
	}

	rules, err := s.FindEnabledRulesSorted(ctx)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return result, nil
	}

	// 查询主机信息用于标签匹配
	agentTagMap := make(map[string][]string, len(agentIDs))
	agents, err := s.agentRepo.FindByIdIn(ctx, agentIDs)
	if err != nil {
		return nil, err
	}
	for _, agent := range agents {
		agentTagMap[agent.ID] = agent.Tags
	}

	for _, agentID := range agentIDs {
		for i := range rules {
			if !ruleMatchesAgent(&rules[i], agentID, agentTagMap[agentID]) {
				continue
			}
			rule := &rules[i]
			result[agentID] = &EffectiveAlertConfig{
				ConfigID:      rule.ID,
				Name:          rule.Name,
				MaskIP:        rule.MaskIP,
				Notifications: rule.Notifications.Data(),
				Rules:         rule.Rules.Data(),
				Channels:      rule.Channels,
			}
			break
		}
	}

	return result, nil
}

// ruleMatchesAgent 判断规则是否命中主机（按目标类型：全部 / 指定主机 / 按标签）
func ruleMatchesAgent(rule *models.AlertRule, agentID string, agentTags []string) bool {
	switch rule.TargetType {
	case "", models.AlertRuleTargetAll:
		return true
	case models.AlertRuleTargetAgents:
		return slices.Contains(rule.AgentIds, agentID)
	case models.AlertRuleTargetTags:
		for _, tag := range agentTags {
			if slices.Contains(rule.Tags, tag) {
				return true
			}
		}
		return false
	default:
		return false
	}
}

// cleanupStates 清理指定规则下的告警状态（agentIDs 为空时清理该规则下全部状态）；
// 正在告警的记录直接标记为已恢复（规则调整而非指标恢复，不发送恢复通知）。
func (s *AlertRuleService) cleanupStates(ctx context.Context, configID string, agentIDs []string) {
	states, err := s.alertStateRepo.FindStatesByConfigID(ctx, configID)
	if err != nil {
		s.logger.Warn("查询告警状态失败", zap.String("configID", configID), zap.Error(err))
		return
	}

	agentSet := make(map[string]struct{}, len(agentIDs))
	for _, agentID := range agentIDs {
		agentSet[agentID] = struct{}{}
	}

	now := time.Now().UnixMilli()
	for _, state := range states {
		if len(agentSet) > 0 {
			if _, ok := agentSet[state.AgentID]; !ok {
				continue
			}
		}

		if state.IsFiring && state.LastRecordID > 0 {
			record, err := s.alertRecordRepo.GetAlertRecordByID(ctx, state.LastRecordID)
			if err == nil && record.Status == "firing" {
				record.Status = "resolved"
				record.ResolvedAt = now
				record.UpdatedAt = now
				if err := s.alertRecordRepo.UpdateAlertRecord(ctx, record); err != nil {
					s.logger.Warn("更新告警记录失败", zap.Int64("recordId", record.ID), zap.Error(err))
				}
			}
		}

		if err := s.alertStateRepo.DeleteAlertState(ctx, state.ID); err != nil {
			s.logger.Warn("删除告警状态失败", zap.String("stateID", state.ID), zap.Error(err))
		}
	}
}

func (s *AlertRuleService) normalizeRuleRequest(req *AlertRuleRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("规则名称不能为空")
	}

	switch req.TargetType {
	case "", models.AlertRuleTargetAll:
		req.TargetType = models.AlertRuleTargetAll
		req.AgentIds = nil
		req.Tags = nil
	case models.AlertRuleTargetAgents:
		if len(req.AgentIds) == 0 {
			return fmt.Errorf("请选择适用主机")
		}
		req.Tags = nil
	case models.AlertRuleTargetTags:
		if len(req.Tags) == 0 {
			return fmt.Errorf("请选择标签")
		}
		req.AgentIds = nil
	default:
		return fmt.Errorf("不支持的主机目标类型: %s", req.TargetType)
	}

	return nil
}
