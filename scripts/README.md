# Pika Agent 升级脚本

## RestartSec 配置升级脚本

### 背景

旧版本的 pika-agent 使用 `kardianos/service` 库的默认模板，导致 systemd 服务的 `RestartSec` 被硬编码为 120 秒。新版本通过自定义模板将其改为 5 秒，以实现更快的故障恢复。

### 一键升级

**推荐方式：直接通过 curl 执行**

```bash
curl -fsSL https://raw.githubusercontent.com/dushixiang/pika/main/scripts/update-restartsec.sh | sudo bash
```

### 脚本功能

1. ✓ 检查是否以 root 权限运行
2. ✓ 检查服务文件是否存在
3. ✓ 检查当前 RestartSec 配置（如果已经是 5 秒则跳过）
4. ✓ 修改 RestartSec 为 5 秒
5. ✓ 重新加载 systemd 配置
6. ✓ 自动重启服务并验证状态

### 验证结果

```bash
# 查看服务文件中的 RestartSec 配置
cat /etc/systemd/system/pika-agent.service | grep RestartSec

# 应该显示: RestartSec=5
```

### 注意事项

- **脚本会自动重启服务以应用新配置**
- 重启过程通常只需 2-3 秒，对监控数据影响极小
- 脚本会自动检测服务重启后的状态，确保服务正常运行

### 批量升级多台服务器

如果有多台服务器需要升级：

```bash
#!/bin/bash

SERVERS=(
    "192.168.1.10"
    "192.168.1.11"
    "192.168.1.12"
)

for server in "${SERVERS[@]}"; do
    echo "================================"
    echo "升级服务器: $server"
    echo "================================"
    ssh root@$server 'curl -fsSL https://raw.githubusercontent.com/dushixiang/pika/main/scripts/update-restartsec.sh | bash'
    echo ""
done

echo "所有服务器升级完成！"
```

### 新版本安装

对于新安装的服务（使用新版本代码重新编译），无需运行此脚本，因为新版本会自动使用正确的配置。

**此脚本仅用于升级已安装的旧版本服务。**
