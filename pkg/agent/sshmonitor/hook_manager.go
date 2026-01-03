package sshmonitor

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
)

const (
	PAMConfigFile   = "/etc/pam.d/sshd"
	PAMConfigLine   = "session optional pam_exec.so /usr/local/bin/pika_ssh_hook.sh"
	HookScriptPath  = "/usr/local/bin/pika_ssh_hook.sh"
	SSHDConfigFile  = "/etc/ssh/sshd_config"
	UsePAMDirective = "UsePAM yes"
)

// HookManager PAM Hook 管理器
type HookManager struct{}

// NewHookManager 创建管理器
func NewHookManager() *HookManager {
	return &HookManager{}
}

// Install 安装 PAM Hook
func (h *HookManager) Install() error {
	// 检查是否为 root 用户
	if os.Geteuid() != 0 {
		return fmt.Errorf("安装 PAM Hook 需要 root 权限")
	}

	// 检查是否已安装（幂等性）
	if h.isInstalled() {
		slog.Info("PAM Hook 已安装，跳过")
		return nil
	}

	// 确保 SSH 配置启用 PAM
	if err := h.ensureUsePAM(); err != nil {
		return fmt.Errorf("配置 SSH UsePAM 失败: %w", err)
	}

	// 部署 Hook 脚本
	if err := h.deployScript(); err != nil {
		return fmt.Errorf("部署脚本失败: %w", err)
	}

	// 修改 PAM 配置
	if err := h.modifyPAMConfig(true); err != nil {
		// 回滚脚本部署
		os.Remove(HookScriptPath)
		return fmt.Errorf("修改 PAM 配置失败: %w", err)
	}

	slog.Info("PAM Hook 安装成功")
	return nil
}

// Uninstall 卸载 PAM Hook
func (h *HookManager) Uninstall() error {
	// 移除 PAM 配置
	if err := h.modifyPAMConfig(false); err != nil {
		slog.Warn("移除 PAM 配置失败", "error", err)
	}

	// 删除脚本文件
	if err := os.Remove(HookScriptPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("删除脚本失败: %w", err)
	}

	slog.Info("PAM Hook 卸载成功")
	return nil
}

// isInstalled 检查是否已安装
func (h *HookManager) isInstalled() bool {
	// 检查 PAM 配置文件是否包含我们的配置行
	f, err := os.Open(PAMConfigFile)
	if err != nil {
		return false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == PAMConfigLine {
			return true
		}
	}

	return false
}

// deployScript 部署 Hook 脚本
func (h *HookManager) deployScript() error {
	// 脚本内容（嵌入式）
	scriptContent := `#!/bin/bash
# Pika SSH Login Hook
# 由 Pika Agent 自动安装

LOG_FILE="/var/log/pika/ssh_login.log"
LOG_DIR="/var/log/pika"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 获取登录信息
TIMESTAMP=$(date +%s)000  # 毫秒时间戳
USERNAME="$PAM_USER"
IP="${PAM_RHOST:-localhost}"
TTY="${PAM_TTY:-unknown}"
SESSION_ID="$$"

# 判断登录状态（通过 PAM_TYPE）
if [ "$PAM_TYPE" = "open_session" ]; then
    STATUS="success"
else
    STATUS="unknown"
fi

# 尝试获取端口号（从 SSH 连接信息）
PORT=$(echo "$SSH_CONNECTION" | awk '{print $2}')

# 尝试获取认证方式（简化处理）
METHOD="password"

# 构建 JSON 日志
JSON_LOG=$(cat <<EOF
{"timestamp":$TIMESTAMP,"username":"$USERNAME","ip":"$IP","port":"$PORT","status":"$STATUS","method":"$METHOD","tty":"$TTY","sessionId":"$SESSION_ID"}
EOF
)

# 追加到日志文件
echo "$JSON_LOG" >> "$LOG_FILE"

exit 0
`

	// 写入脚本文件
	if err := os.WriteFile(HookScriptPath, []byte(scriptContent), 0755); err != nil {
		return err
	}

	slog.Info("PAM Hook 脚本部署成功", "path", HookScriptPath)
	return nil
}

// modifyPAMConfig 修改 PAM 配置
// add: true=添加配置, false=移除配置
func (h *HookManager) modifyPAMConfig(add bool) error {
	// 读取现有配置
	f, err := os.Open(PAMConfigFile)
	if err != nil {
		return err
	}

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	f.Close()

	if err := scanner.Err(); err != nil {
		return err
	}

	// 修改配置
	var newLines []string
	found := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// 跳过我们的配置行（移除模式）或检测是否已存在（添加模式）
		if trimmed == PAMConfigLine {
			found = true
			if add {
				newLines = append(newLines, line) // 保留
			}
			// 移除模式：不添加到 newLines
			continue
		}

		newLines = append(newLines, line)
	}

	// 如果是添加模式且未找到，则添加到文件末尾
	if add && !found {
		newLines = append(newLines, PAMConfigLine)
	}

	// 备份原配置
	backupPath := PAMConfigFile + ".bak"
	if err := os.Rename(PAMConfigFile, backupPath); err != nil {
		return err
	}

	// 写入新配置
	outF, err := os.Create(PAMConfigFile)
	if err != nil {
		// 恢复备份
		os.Rename(backupPath, PAMConfigFile)
		return err
	}
	defer outF.Close()

	writer := bufio.NewWriter(outF)
	for _, line := range newLines {
		writer.WriteString(line + "\n")
	}
	if err := writer.Flush(); err != nil {
		// 恢复备份
		outF.Close()
		os.Rename(backupPath, PAMConfigFile)
		return err
	}

	// 设置正确的权限
	os.Chmod(PAMConfigFile, 0644)

	slog.Info("PAM 配置修改成功", "add", add)
	return nil
}

// ensureUsePAM 确保 SSH 配置启用 PAM
func (h *HookManager) ensureUsePAM() error {
	// 读取现有配置
	f, err := os.Open(SSHDConfigFile)
	if err != nil {
		return err
	}

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	f.Close()

	if err := scanner.Err(); err != nil {
		return err
	}

	// 检查和修改配置
	var newLines []string
	usePAMEnabled := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// 检查是否是 UsePAM 配置行
		if strings.HasPrefix(trimmed, "UsePAM") {
			// 检查是否已启用
			if strings.Contains(trimmed, "yes") && !strings.HasPrefix(trimmed, "#") {
				usePAMEnabled = true
				newLines = append(newLines, line)
			} else {
				// 注释掉旧的配置行
				if !strings.HasPrefix(trimmed, "#") {
					newLines = append(newLines, "# "+line)
				} else {
					newLines = append(newLines, line)
				}
			}
			continue
		}

		newLines = append(newLines, line)
	}

	// 如果 UsePAM 已正确启用,无需修改
	if usePAMEnabled {
		slog.Info("SSH UsePAM 已启用，跳过")
		return nil
	}

	// 如果找到了 UsePAM 但未启用,或者没找到,都需要添加配置
	if !usePAMEnabled {
		newLines = append(newLines, UsePAMDirective)
	}

	// 备份原配置
	backupPath := SSHDConfigFile + ".bak"
	if err := os.Rename(SSHDConfigFile, backupPath); err != nil {
		return err
	}

	// 写入新配置
	outF, err := os.Create(SSHDConfigFile)
	if err != nil {
		// 恢复备份
		os.Rename(backupPath, SSHDConfigFile)
		return err
	}
	defer outF.Close()

	writer := bufio.NewWriter(outF)
	for _, line := range newLines {
		writer.WriteString(line + "\n")
	}
	if err := writer.Flush(); err != nil {
		// 恢复备份
		outF.Close()
		os.Rename(backupPath, SSHDConfigFile)
		return err
	}

	// 设置正确的权限
	os.Chmod(SSHDConfigFile, 0600)

	slog.Info("SSH UsePAM 配置成功")

	// 重启 sshd 服务使配置生效
	if err := h.restartSSHD(); err != nil {
		slog.Warn("重启 sshd 服务失败，请手动重启", "error", err)
		// 不返回错误，因为配置已经成功，只是需要手动重启
	}

	return nil
}

// restartSSHD 重启 sshd 服务
func (h *HookManager) restartSSHD() error {
	// 尝试使用 systemctl (systemd)
	cmd := exec.Command("systemctl", "restart", "sshd")
	if err := cmd.Run(); err == nil {
		slog.Info("已通过 systemctl 重启 sshd 服务")
		return nil
	}

	// 尝试 service 命令 (SysV init)
	cmd = exec.Command("service", "sshd", "restart")
	if err := cmd.Run(); err == nil {
		slog.Info("已通过 service 重启 sshd 服务")
		return nil
	}

	// 尝试直接重启 (某些系统可能使用 ssh 而不是 sshd)
	cmd = exec.Command("systemctl", "restart", "ssh")
	if err := cmd.Run(); err == nil {
		slog.Info("已通过 systemctl 重启 ssh 服务")
		return nil
	}

	cmd = exec.Command("service", "ssh", "restart")
	if err := cmd.Run(); err == nil {
		slog.Info("已通过 service 重启 ssh 服务")
		return nil
	}

	return fmt.Errorf("无法找到合适的方式重启 sshd 服务")
}
