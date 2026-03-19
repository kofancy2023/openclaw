# OpenClaw_Custom 用户完全指南

> 本文档涵盖 OpenClaw_Custom 安全层的安装、配置、日常使用和安全设置。

## 目录

1. [快速开始](#快速开始)
2. [安装步骤](#安装步骤)
3. [日常使用](#日常使用)
4. [环境变量配置](#环境变量配置windows)
5. [Token 配置](#token-配置)
6. [安全配置](#安全配置)
7. [故障排查](#故障排查)
8. [安全检查清单](#安全检查清单)

---

## 快速开始

### 环境要求

| 软件    | 版本      | 用途     |
| ------- | --------- | -------- |
| Node.js | >= 22.0.0 | 运行环境 |
| pnpm    | >= 8.0    | 包管理器 |
| Git     | >= 2.30   | 版本控制 |

### 快速命令速查

```powershell
# ===== 编译 =====
cd d:\mySource\cusor-proj\openclaw
pnpm install
pnpm build:docker

cd OpenClaw_Custom
npx tsc

# ===== 启动/停止 =====
node scripts/dev.mjs status   # 查看状态
node scripts/dev.mjs start    # 启动（前台运行，Ctrl+C 停止）
node scripts/dev.mjs stop     # 停止
node scripts/dev.mjs restart  # 重启

# ===== 访问 =====
# 浏览器打开: http://127.0.0.1:55443/
```

---

## 安装步骤

### 步骤 1：编译 OpenClaw 主项目

```powershell
cd d:\mySource\cusor-proj\openclaw

# 安装依赖
pnpm install

# 编译（Windows 使用 build:docker 跳过 bash）
pnpm build:docker

# 验证编译结果
ls dist/entry.js
```

### 步骤 2：编译安全层

```powershell
cd OpenClaw_Custom

# 安装依赖
pnpm install

# 编译 TypeScript
npx tsc

# 验证编译结果
ls dist/index.js
```

### 步骤 3：注入安全层

```powershell
# 运行注入脚本
scripts/inject-security-layer.ps1

# 验证注入结果（应该看到导入语句）
Get-Content openclaw.mjs -Head 3
# 输出应包含: import './OpenClaw_Custom/dist/index.js';
```

### 步骤 4：配置安全端口

```powershell
# 使用非默认端口（避免 18789）
node openclaw.mjs config set gateway.port 55443
node openclaw.mjs config set gateway.bind loopback
```

---

## 6星-日常使用

### 开发环境控制（推荐）

使用 `dev.mjs` 脚本轻松控制 Gateway：

```powershell
# 注意要先把docker跑起来

cd d:\mySource\cusor-proj\openclaw\OpenClaw_Custom

# 查看当前状态
node scripts/dev.mjs status

# 启动 Gateway（前台运行，按 Ctrl+C 停止）
node scripts/dev.mjs start

# 停止 Gateway
node scripts/dev.mjs stop

# 重启 Gateway
node scripts/dev.mjs restart
```

**特点：**

- ✅ 前台运行，实时查看日志
- ✅ 按 `Ctrl+C` 随时停止
- ✅ 自动检测并停止旧实例
- ✅ 自动加载安全层

### 日常开发流程

```powershell
# 1. 开始工作 - 启动 Gateway
cd d:\mySource\cusor-proj\openclaw\OpenClaw_Custom
node scripts/dev.mjs start

# 2. 开发过程中 - 在浏览器访问
# http://127.0.0.1:55443/chat?session=main

# 3. 结束工作 - 按 Ctrl+C 停止
```

### 验证运行状态

```powershell
# 使用开发工具查看状态
node scripts/dev.mjs status

# 或使用 OpenClaw 命令
node openclaw.mjs gateway status

# 运行诊断
node openclaw.mjs doctor
```

### 成功运行的标志

启动时会显示：

```
╔════════════════════════════════════════════════════════╗
║ OpenClaw_Custom Security Layer Initialized            ║
╚════════════════════════════════════════════════════════╝
✅ Module hooks installed
✅ Execution hooks installed
✅ Credential encryption active

Gateway running on http://127.0.0.1:55443
```

---

## 环境变量配置（Windows）

配置 API Keys 和其他环境变量，用于国内/国际模型备用。

### 方法 1：当前会话（临时）

仅在当前 PowerShell 窗口有效：

```powershell
# 设置 API Keys
$env:MOONSHOT_API_KEY="sk-your-moonshot-key"
$env:ZHIPU_API_KEY="your-zhipu-key"
$env:ANTHROPIC_API_KEY="sk-ant-your-key"
$env:OPENAI_API_KEY="sk-your-openai-key"

# 设置加密主密钥（用于凭证加密）
$env:OPENCLAW_MASTER_KEY="your-32-byte-base64-key"

# 验证
echo $env:MOONSHOT_API_KEY
```

### 方法 2：永久设置（推荐）

对当前用户永久有效：

```powershell
# 设置用户环境变量
[Environment]::SetEnvironmentVariable("MOONSHOT_API_KEY", "sk-your-moonshot-key", "User")
[Environment]::SetEnvironmentVariable("ZHIPU_API_KEY", "your-zhipu-key", "User")

# 验证（需要新开 PowerShell 窗口）
echo $env:MOONSHOT_API_KEY
```

### 方法 3：使用 .env 文件（项目级）

在 `OpenClaw_Custom` 目录创建 `.env` 文件：

```powershell
# 创建 .env 文件
@"
# 大模型 API Keys
MOONSHOT_API_KEY=sk-your-moonshot-key
ZHIPU_API_KEY=your-zhipu-key
ANTHROPIC_API_KEY=sk-ant-your-key
OPENAI_API_KEY=sk-your-openai-key

# 加密主密钥
OPENCLAW_MASTER_KEY=your-32-byte-base64-key
"@ | Out-File -FilePath .env -Encoding UTF8
```

加载环境变量：

```powershell
# 加载 .env 文件
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}
```

### 方法 4：Windows 图形界面

1. 按 `Win + R`，输入 `sysdm.cpl` 回车
2. 点击 **"高级"** → **"环境变量"**
3. 在 **"用户变量"** 区域点击 **"新建"**
4. 输入变量名和值，点击确定
5. 重启 PowerShell

### 快速验证

```powershell
# 查看所有相关环境变量
Get-ChildItem Env: | Where-Object { 
    $_.Name -like "*MOONSHOT*" -or 
    $_.Name -like "*ZHIPU*" -or 
    $_.Name -like "*OPENCLAW*" 
}
```

### 环境变量说明

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `MOONSHOT_API_KEY` | Moonshot API 密钥 | 否（使用国内模型时需要） |
| `ZHIPU_API_KEY` | Zhipu GLM API 密钥 | 否（使用国内模型时需要） |
| `ANTHROPIC_API_KEY` | Anthropic Claude 密钥 | 否（使用国际模型时需要） |
| `OPENAI_API_KEY` | OpenAI API 密钥 | 否（使用国际模型时需要） |
| `OPENCLAW_MASTER_KEY` | 凭证加密主密钥 | 是（如果使用加密存储） |

### 设置默认模型

配置好环境变量后，设置默认使用的模型：

```powershell
# 设置默认使用本地 Ollama qwen3.5:9b
openclaw models set ollama/qwen3.5:9b

# 或切换到国内模型
openclaw models set moonshot/kimi-k2.5
openclaw models set zhipu/glm-5
```

**快速切换命令：**

```powershell
# 查看所有可用模型
openclaw models list

# 查看当前活跃模型
openclaw models status

# 设置模型别名（方便切换）
openclaw models aliases add local ollama/qwen3.5:9b
openclaw models aliases add kimi moonshot/kimi-k2.5
# 之后可以使用: openclaw models set local
```

---

## Token 配置

第一次访问 Dashboard 时需要配置 Gateway Token。

### 获取 Token

**方法 1：查看配置文件（推荐）**

```powershell
# Windows PowerShell
Get-Content ~/.openclaw/openclaw.json | findstr "token"

# 或者查看完整配置文件
cat ~/.openclaw/openclaw.json
```

**方法 2：生成新 Token**

```powershell
# 生成新的随机 token
$token = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
node openclaw.mjs config set gateway.auth.token $token
Write-Host "New token: $token"
```

### 浏览器配置

1. **打开 Dashboard**：http://127.0.0.1:55443/
2. **输入 Token**：

   - 点击右上角的 **设置图标**（⚙️）
   - 找到 **Gateway Token** 输入框
   - 粘贴刚才获取的 token
   - 点击 **Connect** 或 **Save**

### 快捷启动（免 Token 输入）

**方法 1：使用 URL 参数**

```
http://127.0.0.1:55443/?token=YOUR_TOKEN_HERE
```

**方法 2：配置文件自动加载**

确保 `~/.openclaw/openclaw.json` 中包含：

```json
{
  "gateway": {
    "auth": {
      "token": "your-secure-token-here"
    }
  }
}
```

### Token 安全建议

1. **长度**：至少 32 个随机字符
2. **复杂度**：包含大小写字母、数字
3. **保密**：不要提交到版本控制
4. **轮换**：定期更换 token（建议每月）

---

## 安全配置

### 为什么修改默认端口 18789？

默认端口是众所周知端口，可能面临：

- **自动化扫描**：攻击者会扫描此端口
- **针对性攻击**：已知端口更容易被针对
- **信息泄露**：暴露服务存在

### 安全端口配置

```powershell
# 设置非默认端口
node openclaw.mjs config set gateway.port 55443

# 仅监听本地地址
node openclaw.mjs config set gateway.bind loopback

# 验证配置
node openclaw.mjs config get gateway.port
```

**推荐端口范围**：49152-65535（动态私有端口）

**避免使用**：

- 18789（OpenClaw 默认）
- 8080, 8888, 3000（常见开发端口）
- 1-1024（特权端口）

### 防火墙配置（Windows）

```powershell
# 以管理员身份运行

# 允许新端口
netsh advfirewall firewall add rule name="OpenClaw Custom Port" dir=in action=allow protocol=tcp localport=55443

# 阻止默认端口（可选）
netsh advfirewall firewall add rule name="Block OpenClaw Default Port" dir=in action=block protocol=tcp localport=18789
```

### 安全功能开关

| 功能       | 环境变量                         | 推荐值   | 说明             |
| ---------- | -------------------------------- | -------- | ---------------- |
| 命令沙盒   | `OPENCLAW_SANDBOX_COMMANDS`    | `true` | 阻止危险命令执行 |
| 凭证加密   | `OPENCLAW_ENCRYPT_CREDENTIALS` | `true` | 加密存储敏感凭证 |
| Skill 扫描 | `OPENCLAW_SKILL_SECURITY`      | `true` | 安装前安全检查   |

### 完整安全配置文件示例

```json
{
  "gateway": {
    "port": 55443,
    "host": "127.0.0.1",
    "bind": "loopback",
    "authRequired": true
  },
  "websocket": {
    "allowedOrigins": ["http://localhost:55443"],
    "tokenBinding": true
  },
  "skills": {
    "staticAnalysis": true,
    "behaviorTesting": true,
    "sandboxInstall": true
  }
}
```

---

## 故障排查

### 问题 1："missing dist/entry.js"

```powershell
# 原因：主项目未编译
# 解决：
pnpm build:docker
```

### 问题 2："Cannot find module '../dist/index.js'"

```powershell
# 原因：安全层未编译
# 解决：
cd OpenClaw_Custom
npx tsc
```

### 问题 3："Port 18789 already in use"

```powershell
# 原因：端口被占用
# 解决：使用非默认端口
node openclaw.mjs config set gateway.port 55443
node scripts/dev.mjs restart
```

### 问题 4："gateway already running"

```powershell
# 原因：已有实例在运行
# 解决：先停止旧实例
node scripts/dev.mjs stop
node scripts/dev.mjs start
```

### 问题 5：安全层未生效

```powershell
# 检查注入
Get-Content openclaw.mjs -Head 5

# 应该显示：
# // OpenClaw Custom Security Layer...
# import './OpenClaw_Custom/dist/index.js';

# 如果没显示，重新注入
OpenClaw_Custom/scripts/inject-security-layer.ps1
```

### 问题 6：Token 失效或无法访问 Dashboard

```powershell
# 重新生成 token
$token = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
node openclaw.mjs config set gateway.auth.token $token

# 确认 gateway 在运行
node openclaw.mjs gateway status
```

### 问题 7：npm install 失败

```powershell
# 清除缓存后重试
npm cache clean --force
Remove-Item -Recurse -Force node_modules
npm install
```

### 问题 8：PowerShell 执行策略限制

```powershell
# 错误：无法加载文件 xxx.ps1，因为在此系统上禁止运行脚本

# 以管理员身份运行：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 验证
Get-ExecutionPolicy
```

---

## 安全检查清单

部署前请确认以下设置：

### 端口安全

- [ ] **使用非默认端口** (非 18789)
  - 推荐端口范围: 49152-65535
- [ ] **绑定到本地地址** (127.0.0.1)
  - 防止外部网络直接访问
- [ ] **配置防火墙规则**
  - 仅开放必要的端口

### 功能安全

- [ ] **命令沙盒已启用** (`OPENCLAW_SANDBOX_COMMANDS=true`)
- [ ] **凭证加密已启用** (`OPENCLAW_ENCRYPT_CREDENTIALS=true`)
- [ ] **Skill 扫描已启用** (`OPENCLAW_SKILL_SECURITY=true`)
- [ ] **WebSocket 验证已启用** (配置 `allowedOrigins`)

### 访问控制

- [ ] **Gateway Token 已设置**
- [ ] **Token 长度 >= 32 字符**
- [ ] **Token 定期轮换**

### 验证步骤

```powershell
# 1. 检查端口配置
node openclaw.mjs config get gateway.port
# 预期: 55443 (非 18789)

# 2. 检查绑定地址
node openclaw.mjs config get gateway.bind
# 预期: loopback

# 3. 验证安全层状态
node scripts/dev.mjs status

# 4. 运行诊断
node openclaw.mjs doctor
```

---

## 常用命令速查表

| 命令                                                | 用途                     |
| --------------------------------------------------- | ------------------------ |
| `node scripts/dev.mjs start`                      | 启动 Gateway（开发推荐） |
| `node scripts/dev.mjs stop`                       | 停止 Gateway             |
| `node scripts/dev.mjs status`                     | 查看状态                 |
| `node scripts/dev.mjs restart`                    | 重启 Gateway             |
| `pnpm build:docker`                               | 编译 OpenClaw（Windows） |
| `npx tsc`                                         | 编译安全层               |
| `node openclaw.mjs gateway status`                | 检查 Gateway 状态        |
| `node openclaw.mjs doctor`                        | 诊断问题                 |
| `node openclaw.mjs config set gateway.port 55443` | 设置端口                 |
| `node openclaw.mjs config get gateway.auth.token` | 获取 Token               |

---

## 相关文档

- [README.md](./README.md) - 项目总览
- [MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md) - 大模型配置指南
- [MODEL_SWITCH_GUIDE.md](./MODEL_SWITCH_GUIDE.md) - 模型切换快速参考
- [docs/TOKEN_SETUP.md](./docs/TOKEN_SETUP.md) - Token 配置详细说明
