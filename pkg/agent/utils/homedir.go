package utils

import (
	"os"
	"os/user"
)

func GetSafeHomeDir() string {
	// 1. 尝试从环境变量拿（最快，符合大多数 Unix/Windows 惯例）
	if h, err := os.UserHomeDir(); err == nil && h != "" {
		return h
	}

	// 2. 尝试从系统底层数据库拿（绕过环境变量，直接看 /etc/passwd）
	if u, err := user.Current(); err == nil && u.HomeDir != "" {
		return u.HomeDir
	}

	// 3. 特殊环境兜底（针对 OpenWrt/嵌入式等 root 为主的系统）
	// 如果是 root 权限运行但没设家目录，通常就是 /root
	if os.Getuid() == 0 {
		if _, err := os.Stat("/root"); err == nil {
			return "/root"
		}
	}

	// 4. 极端情况兜底：使用当前程序运行目录或临时目录
	// 保证程序至少能跑起来，而不是直接 panic 或报错退出
	if pwd, err := os.Getwd(); err == nil {
		return pwd
	}

	return "./"
}
