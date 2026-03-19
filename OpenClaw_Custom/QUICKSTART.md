# OpenClaw + OpenClaw_Custom 快速启动指南

## 状态概览

| 组件 | 状态 | 说明 |
|------|------|------|
| OpenClaw Gateway | ✅ 运行中 | PID: 19840, 端口: 55443 |
| OpenClaw_Custom 安全层 | ✅ 已启用 | 配置已加载 |
| Master Key | ✅ 已设置 | 环境变量已配置 |
| 模型配置 | ✅ 已配置 | GLM-5 + 备用模型 |

## 访问地址

- **Dashboard**: http://127.0.0.1:55443/
- **WebChat**: http://127.0.0.1:55443/chat
- **Gateway**: ws://127.0.0.1:55443/ws

## 启动命令

### 启动 Gateway
```powershell
# 方式 1: 使用开发脚本
cd OpenClaw_Custom
node scripts/dev.mjs start

# 方式 2: 直接启动
$env:OPENCLAW_CUSTOM_ENABLED = "true"
node openclaw.mjs gateway run --port 55443 --bind loopback
```

### 查看状态
```powershell
node OpenClaw_Custom/scripts/dev.mjs status
```

### 停止 Gateway
```powershell
node OpenClaw_Custom/scripts/dev.mjs stop
```

## 安全特性

OpenClaw_Custom 安全层已启用以下保护：

| 缓解措施 | 代码 | 状态 |
|---------|------|------|
| WebSocket Origin 验证 | OC-001 | ✅ 已启用 |
| 命令执行沙箱 | OC-002 | ✅ 已启用 |
| 凭证加密存储 | OC-003 | ✅ 已启用 |
| Skill 安全扫描 | OC-006 | ✅ 已启用 |

## 配置信息

- **配置文件**: `~/.openclaw/openclaw-custom/models-security.json5`
- **主密钥**: 已保存到用户环境变量 `OPENCLAW_MASTER_KEY`
- **安全目录**: `~/.openclaw/secure/`
- **审计日志**: `~/.openclaw/audit/`

## 模型配置

当前配置的模型（来自 OpenClaw 配置）：

| 模型 | 提供商 | 类型 |
|------|--------|------|
| GLM-5 | Z.AI | 主模型 |
| GLM-5 Turbo | Z.AI | 备用 |
| GLM-4.7 | Z.AI | 备用 |
| qwen3.5:0.8b | Ollama | 本地备用 |
| kimi-k2.5 | Moonshot | 云端备用 |

## 故障排除

### 端口被占用
```powershell
# 查找占用 55443 的进程
netstat -ano | findstr "55443"

# 强制终止
Stop-Process -Id <PID> -Force
```

### 主密钥未设置
```powershell
# 生成新密钥
$key = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
[Environment]::SetEnvironmentVariable("OPENCLAW_MASTER_KEY", $key, "User")
```

### 重置配置
```powershell
# 删除配置目录后重新启动
Remove-Item -Recurse -Force ~/.openclaw/openclaw-custom
# 然后重新运行设置
```

## 下一步

1. 访问 http://127.0.0.1:55443/ 打开 Dashboard
2. 使用 WebChat 与 AI 助手对话
3. 配置更多消息渠道（Telegram、Discord 等）
4. 安装和管理 Skills

## 更多信息

- [用户指南](USER_GUIDE.md)
- [模型配置指南](MODEL_CONFIGURATION.md)
- [Token 设置](docs/TOKEN_SETUP.md)
