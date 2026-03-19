# OpenClaw_Custom 脚本使用说明

## 目录

清理整合后，只保留核心脚本：

| 脚本 | 用途 | 平台 |
|------|------|------|
| `dev.mjs` | 主要开发控制脚本（推荐） | 跨平台 |
| `gateway.ps1` | Gateway 启动器（带安全层检查） | Windows |
| `model-config.ps1` | 模型配置工具 | Windows |
| `setup-firewall.ps1` | Windows 防火墙配置 | Windows |
| `verify.ps1` | 验证安装（PowerShell） | Windows |
| `verify.sh` | 验证安装（Bash） | macOS/Linux |

## 快速开始

### 1. 开发控制脚本 (dev.mjs) ⭐ 推荐

跨平台 Node.js 脚本，支持所有主要操作：

```bash
# 启动 Gateway（前台运行，Ctrl+C 停止）
node scripts/dev.mjs start

# 指定端口启动
node scripts/dev.mjs start --port 8080

# 查看状态
node scripts/dev.mjs status

# 停止 Gateway
node scripts/dev.mjs stop

# 重启 Gateway
node scripts/dev.mjs restart

# 验证安全层安装
node scripts/dev.mjs verify

# 配置模型
node scripts/dev.mjs config local     # 纯本地模式
node scripts/dev.mjs config hybrid    # 混合模式
node scripts/dev.mjs config cn        # 国内优先

# 显示帮助
node scripts/dev.mjs help
```

### 2. Gateway 启动器 (gateway.ps1)

Windows PowerShell 脚本，带完整的安全层检查：

```powershell
# 启动 Gateway
.\scripts\gateway.ps1

# 指定端口
.\scripts\gateway.ps1 -Port 8080

# 仅查看状态
.\scripts\gateway.ps1 -StatusOnly
```

### 3. 模型配置 (model-config.ps1)

快速切换模型配置模式：

```powershell
# 纯本地模式（Ollama qwen3.5:9b）
.\scripts\model-config.ps1 -Mode local

# 混合模式（本地优先，国内备用）
.\scripts\model-config.ps1 -Mode hybrid

# 国内优先（Kimi/GLM）
.\scripts\model-config.ps1 -Mode cn
```

### 4. 防火墙配置 (setup-firewall.ps1)

配置 Windows 防火墙规则（需要管理员权限）：

```powershell
# 添加防火墙规则（默认端口 55443）
.\scripts\setup-firewall.ps1

# 指定端口
.\scripts\setup-firewall.ps1 -Port 8080

# 同时阻止默认端口 18789
.\scripts\setup-firewall.ps1 -Port 55443 -BlockDefaultPort

# 移除规则
.\scripts\setup-firewall.ps1 -RemoveRules
```

### 5. 验证脚本 (verify.ps1 / verify.sh)

验证安全层是否正确安装：

```powershell
# Windows
.\scripts\verify.ps1
```

```bash
# macOS/Linux
bash scripts/verify.sh
```

## 已删除的脚本

以下脚本已被删除（功能被整合到 dev.mjs 或其他脚本中）：

| 删除的脚本 | 替代方案 |
|-----------|---------|
| `dev-start.ps1` | `dev.mjs start` |
| `dev-stop.ps1` | `dev.mjs stop` |
| `dev-status.ps1` | `dev.mjs status` |
| `launch-gateway.ps1` | `dev.mjs start` 或 `gateway.ps1` |
| `launch-with-security.ps1` | `gateway.ps1` |
| `inject-security-layer.ps1` | 不再需要 |
| `env-config.ps1` | 功能整合到 dev.mjs |
| `build-windows.ps1` | 使用主项目构建脚本 |
| `install.bat` | 使用 `npm install` |

## 环境变量

脚本使用以下环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCLAW_GATEWAY_PORT` | Gateway 端口 | 55443 |
| `OPENCLAW_GATEWAY_HOST` | 绑定地址 | 127.0.0.1 |
| `OPENCLAW_CUSTOM_ENABLED` | 启用安全层 | true |
| `OPENCLAW_MASTER_KEY` | 主密钥（用于加密） | - |

## 配置路径

| 配置 | 路径 |
|------|------|
| OpenClaw 配置 | `~/.openclaw/openclaw.json` |
| 安全层配置 | `~/.openclaw/openclaw-custom/models-security.json5` |
| 安全存储 | `~/.openclaw/secure/` |
| 审计日志 | `~/.openclaw/audit/` |
