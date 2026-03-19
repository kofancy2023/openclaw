# 模型切换快速指南

## 场景 1：默认使用本地 Ollama 模型

```powershell
# 方法 1：使用 PowerShell 脚本（推荐）
cd OpenClaw_Custom
.\scripts\set-default-model.ps1 -Mode local

# 方法 2：手动复制配置
copy config\models-security.local.json5 %USERPROFILE%\.openclaw\openclaw-custom\models-security.json5

# 设置默认模型
openclaw models set ollama/qwen3.5:9b
```

## 场景 2：混合模式（本地优先，国内备用）

```powershell
# 使用脚本
cd OpenClaw_Custom
.\scripts\set-default-model.ps1 -Mode hybrid

# 或手动配置
copy config\models-security.hybrid.json5 %USERPROFILE%\.openclaw\openclaw-custom\models-security.json5
```

**混合模式特点：**

- 默认使用 `ollama/qwen3.5:9b`
- Ollama 不可用时自动切换到 `moonshot/kimi-k2.5`
- 敏感数据自动使用本地 `qwen3.5:0.8b`

## 场景 3：切换到国内模型

### 临时切换（当前会话）

```powershell
# 切换到 Kimi K2.5
openclaw models set moonshot/kimi-k2.5

# 切换到 GLM-5
openclaw models set zhipu/glm-5
```

### 永久切换到国内优先

```powershell
# 使用脚本
cd OpenClaw_Custom
.\scripts\set-default-model.ps1 -Mode cn

# 设置 API Keys（必需）
$env:MOONSHOT_API_KEY="sk-your-moonshot-key"
$env:ZHIPU_API_KEY="your-zhipu-key"
```

## 快速切换命令

```powershell
# ========== 查看 ==========
openclaw models list           # 查看所有可用模型
openclaw models status         # 查看当前活跃模型

# ========== 切换 ==========
openclaw models set ollama/qwen3.5:9b       # 本地 9B
openclaw models set ollama/qwen3.5:0.8b     # 本地 0.8B（快速）
openclaw models set moonshot/kimi-k2.5      # Kimi
openclaw models set zhipu/glm-5             # GLM-5

# ========== 别名 ==========
openclaw models aliases add local ollama/qwen3.5:9b
openclaw models aliases add kimi moonshot/kimi-k2.5
# 之后可以使用: /model local 或 /model kimi
```

## 常见问题

### Q1: "模型不可用" 错误

```powershell
# 检查 Ollama 是否运行
ollama list
ollama ps

# 如果未运行，启动它
ollama serve

# 检查模型是否存在
ollama pull qwen3.5:9b
```

### Q2: "API Key 缺失" 错误（国内模型）

```powershell
# 设置 API Keys
$env:MOONSHOT_API_KEY="sk-your-moonshot-key"
$env:ZHIPU_API_KEY="your-zhipu-key"

# 永久设置
[Environment]::SetEnvironmentVariable("MOONSHOT_API_KEY", "sk-your-key", "User")
```

### Q3: 如何验证当前使用的模型？

```powershell
# 查看当前活跃模型
openclaw models status

# 或查看日志（显示模型切换记录）
tail -n 50 %USERPROFILE%\.openclaw\openclaw-custom\audit.log
```

## 配置位置

```
%USERPROFILE%\.openclaw\openclaw-custom\
├── models-security.json5    # 当前生效的配置
├── credentials\             # API Keys 加密存储
└── audit.log                # 模型切换日志
```
