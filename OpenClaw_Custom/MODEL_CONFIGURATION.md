# OpenClaw_Custom 大模型配置完全指南

> 本文档涵盖模型安全层的所有配置选项，包括混合模型、本地模型、国内模型等配置场景。

## 目录

1. [快速开始](#快速开始)
2. [配置文件位置](#配置文件位置)
3. [混合模型配置（推荐）](#混合模型配置推荐)
4. [本地模型配置](#本地模型配置)
5. [国内优先配置](#国内优先配置)
6. [配置详解](#配置详解)
7. [CLI 命令](#cli-命令)
8. [故障排查](#故障排查)

---

## 快速开始
```

# 0.8B 模型加载更快（仅需 1GB 内存）
ollama run qwen3.5:0.8b

cd d:\mySource\cusor-proj\openclaw
node openclaw.mjs models set ollama/qwen3.5:0.8b
```

### 第一步：选择配置模板

| 配置场景         | 使用文件                         | 说明                   |
| ---------------- | -------------------------------- | ---------------------- |
| 混合模型（推荐） | `models-security.hybrid.json5` | 本地 → 国内 → 国际   |
| 纯本地           | `models-security.local.json5`  | 仅使用 Ollama 本地模型 |
| 国内优先         | `models-security.cn.json5`     | 优先使用 Moonshot/Kimi |
| 纯 Qwen 3.5      | `models-security.qwen35.json5` | 仅使用 Qwen 3.5 系列   |

### 第二步：安装配置

```bash
# 创建配置目录
## 即：C:\Users\ROG\.openclaw\openclaw-custom\
mkdir -p ~/.openclaw/openclaw-custom

# 复制混合配置（推荐）
cp OpenClaw_Custom/config/models-security.hybrid.json5 ~/.openclaw/openclaw-custom/models-security.json5

# 设置环境变量（可选，用于国内/国际模型备用）
export MOONSHOT_API_KEY="your-moonshot-key"
export ZHIPU_API_KEY="your-zhipu-key"
```

### 第三步：验证配置

```bash
# 检查配置是否加载
node openclaw.mjs models list

# 查看当前活跃模型
node openclaw.mjs models status

# 测试模型连接
node OpenClaw_Custom/example/check-status.mjs
```

---

## 配置文件位置

安全层按以下顺序查找配置文件：

1. **环境变量指定**: `$OPENCLAW_MODEL_SECURITY_CONFIG`
2. **默认路径**: `~/.openclaw/openclaw-custom/models-security.json5`
3. **项目路径**: `./OpenClaw_Custom/config/models-security.json5`

### 配置文件结构

```
~/.openclaw/openclaw-custom/
├── models-security.json5    # 主配置文件
├── credentials/             # 加密凭证存储
│   ├── moonshot.enc
│   └── anthropic.enc
└── audit.log               # 审计日志
```

---

## 混合模型配置（推荐）

混合配置策略：**本地 Ollama → 国内 Kimi/GLM → 国际 Claude/GPT**

### 故障转移链优先级

| 优先级 | 模型                            | 类型       | 适用场景             | 超时 |
| ------ | ------------------------------- | ---------- | -------------------- | ---- |
| 1      | `ollama/qwen3.5:9b`           | 本地主模型 | 日常对话、编程、创意 | 30s  |
| 2      | `ollama/qwen3.5:0.8b`         | 本地轻量   | 敏感数据、快速响应   | 15s  |
| 3      | `ollama/qwen3.5:latest`       | 本地最新   | 自动更新时使用       | 30s  |
| 4      | `moonshot/kimi-k2.5`          | 国内主模型 | 本地不可用时         | 45s  |
| 5      | `zhipu/glm-5`                 | 国内备用   | Kimi 不可用时        | 45s  |
| 6      | `anthropic/claude-sonnet-4-5` | 国际平衡   | 国内不可用时         | 60s  |
| 7      | `openai/gpt-4o-mini`          | 国际快速   | 最后备用             | 30s  |

### 智能路由规则

```json5
{
  contentClassification: {
    enabled: true,
    rules: [
      // 敏感数据 → 本地轻量模型
      {
        name: 'sensitive-data',
        patterns: ['\\d{17}[\\dXx]', '身份证', '银行卡', '密码'],
        action: { type: 'route', target: 'ollama/qwen3.5:0.8b' },
        priority: 100
      },
      // 编程任务 → 本地主模型
      {
        name: 'coding-task',
        patterns: ['编程', '写代码', 'debug', '算法'],
        action: { type: 'route', target: 'ollama/qwen3.5:9b' },
        priority: 80
      },
      // 创意写作 → Kimi（文学能力强）
      {
        name: 'creative-writing',
        patterns: ['写一篇', '写故事', '创作', '小说', '诗歌', '文案', '润色'],
        action: { type: 'route', target: 'moonshot/kimi-k2.5' },
        priority: 70
      },
      // 分析任务 → Kimi
      {
        name: 'analysis-task',
        patterns: ['分析', '总结', '报告'],
        action: { type: 'route', target: 'moonshot/kimi-k2.5' },
        priority: 50
      }
    ]
  }
}
```

### 混合配置使用示例

```bash
# 1. 复制配置
cp OpenClaw_Custom/config/models-security.hybrid.json5 \
   ~/.openclaw/openclaw-custom/models-security.json5

# 2. 设置主模型（本地 9B）
openclaw models set ollama/qwen3.5:9b

# 3. 启动并测试
openclaw agent --message "你好"

# 4. 测试故障转移（停止 Ollama 后，会自动切换到 Kimi）
```

---

## 本地模型配置

纯本地配置，所有数据不出本地机器。

### 前置要求

```bash
# 安装 Ollama
winget install Ollama.Ollama  # Windows
brew install ollama           # macOS

# 拉取 Qwen 3.5 模型
ollama pull qwen3.5:9b
ollama pull qwen3.5:0.8b

# 验证安装
ollama list
ollama run qwen3.5:9b "你好"
```

### 本地配置示例

```json5
{
  defaultRegion: 'local',
  
  allowedModels: [
    'ollama/qwen3.5:9b',
    'ollama/qwen3.5:0.8b',
    'ollama/qwen3.5:latest'
  ],
  
  blockedModels: [
    'moonshot/*',
    'anthropic/*',
    'openai/*'
  ],
  
  failover: {
    chain: [
      { model: 'ollama/qwen3.5:9b', region: 'local' },
      { model: 'ollama/qwen3.5:0.8b', region: 'local' }
    ]
  },
  
  regionRouting: {
    local: {
      providers: ['ollama'],
      endpoints: {
        ollama: 'http://localhost:11434/v1'
      }
    }
  }
}
```

### 本地模型性能对比

| 特性     | qwen3.5:9b     | qwen3.5:0.8b       |
| -------- | -------------- | ------------------ |
| 模型大小 | 9B 参数        | 0.8B 参数          |
| 显存需求 | ~6GB           | ~1GB               |
| 响应速度 | 中等           | 极快               |
| 推理能力 | 强             | 基础               |
| 适用场景 | 复杂任务、编程 | 简单对话、敏感数据 |

---

## 国内优先配置

优先使用国内模型，确保数据合规。

### 配置示例

```json5
{
  defaultRegion: 'cn',
  
  allowedModels: [
    // 国内模型
    'moonshot/kimi-k2.5',
    'moonshot/kimi-k2.5-caching',
    'zhipu/glm-5',
    'zhipu/glm-5-flash',
  
    // 本地备用
    'ollama/qwen3.5:9b',
    'ollama/qwen3.5:0.8b'
  ],
  
  blockedModels: [
    'anthropic/*',
    'openai/*',
    'google/*'
  ],
  
  failover: {
    chain: [
      { model: 'moonshot/kimi-k2.5', region: 'cn' },
      { model: 'zhipu/glm-5', region: 'cn' },
      { model: 'ollama/qwen3.5:9b', region: 'local' }
    ]
  },
  
  credentials: {
    providers: {
      moonshot: {
        type: 'api-key',
        keyRef: 'env:MOONSHOT_API_KEY'
      },
      zhipu: {
        type: 'api-key',
        keyRef: 'env:ZHIPU_API_KEY'
      }
    }
  }
}
```

### 设置 API 密钥

```bash
# 设置环境变量
export MOONSHOT_API_KEY="sk-your-moonshot-key"
export ZHIPU_API_KEY="your-zhipu-key"

# 持久化到 ~/.bashrc
echo 'export MOONSHOT_API_KEY="sk-xxx"' >> ~/.bashrc
```

---

## 配置详解

### 完整配置结构

```json5
{
  // ========== 基础设置 ==========
  defaultRegion: 'local',  // 'local' | 'cn' | 'global'
  debug: false,
  
  // ========== 模型白名单/黑名单 ==========
  allowedModels: [
    'ollama/qwen3.5:9b',
    'moonshot/kimi-k2.5'
  ],
  blockedModels: [
    'anthropic/*',
    'openai/*'
  ],
  
  // ========== 故障转移 ==========
  failover: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    chain: [
      { model: 'ollama/qwen3.5:9b', region: 'local', timeout: 30000 },
      { model: 'moonshot/kimi-k2.5', region: 'cn', timeout: 45000 }
    ]
  },
  
  // ========== 区域路由 ==========
  regionRouting: {
    enabled: true,
    defaultRegion: 'local',
    regions: {
      local: {
        providers: ['ollama'],
        endpoints: { ollama: 'http://localhost:11434/v1' }
      },
      cn: {
        providers: ['moonshot', 'zhipu'],
        dataResidencyCheck: true
      },
      global: {
        providers: ['anthropic', 'openai']
      }
    }
  },
  
  // ========== 内容分类与智能路由 ==========
  contentClassification: {
    enabled: true,
    rules: [
      {
        name: 'rule-name',
        patterns: ['regex-pattern', '关键词'],
        action: { type: 'route', target: 'model-name' },
        priority: 100
      }
    ]
  },
  
  // ========== 访问控制 ==========
  accessControl: {
    enabled: true,
    permissions: [
      {
        role: 'user',
        allow: ['ollama/*', 'moonshot/*'],
        deny: ['anthropic/*']
      },
      {
        role: 'admin',
        allow: ['*'],
        deny: []
      }
    ]
  },
  
  // ========== 凭证管理 ==========
  credentials: {
    storage: 'file',  // 'file' | 'memory' | 'keyring'
    encryption: true,
    providers: {
      moonshot: {
        type: 'api-key',
        keyRef: 'env:MOONSHOT_API_KEY'
      }
    }
  },
  
  // ========== 审计日志 ==========
  audit: {
    enabled: true,
    level: 'info',
    events: ['model-switch', 'policy-violation', 'failover-triggered'],
    storage: {
      type: 'file',
      path: '~/.openclaw/openclaw-custom/audit.log'
    }
  },
  
  // ========== 健康检查 ==========
  healthCheck: {
    enabled: true,
    interval: 60000,
    checks: [
      { model: 'ollama/qwen3.5:9b', timeout: 10000 }
    ]
  },
  
  // ========== 性能优化 ==========
  performance: {
    warmup: {
      enabled: true,
      models: ['ollama/qwen3.5:9b']
    },
    cache: {
      enabled: true,
      ttl: 300
    }
  }
}
```

### 环境变量

| 变量                    | 说明               | 示例           |
| ----------------------- | ------------------ | -------------- |
| `OPENCLAW_MASTER_KEY` | 凭证加密主密钥     | `base64:xxx` |
| `MOONSHOT_API_KEY`    | Moonshot API 密钥  | `sk-xxx`     |
| `ZHIPU_API_KEY`       | Zhipu API 密钥     | `xxx`        |
| `ANTHROPIC_API_KEY`   | Anthropic API 密钥 | `sk-ant-xxx` |
| `OPENAI_API_KEY`      | OpenAI API 密钥    | `sk-xxx`     |

---

## CLI 命令

### 模型管理

```bash
# 查看模型列表
openclaw models list

# 设置主模型
openclaw models set ollama/qwen3.5:9b

# 添加备用模型
openclaw models fallbacks add moonshot/kimi-k2.5

# 设置模型别名
openclaw models aliases add qwen ollama/qwen3.5:9b
openclaw models aliases add kimi moonshot/kimi-k2.5

# 在对话中使用别名
/model qwen
你好
```

### 配置管理

```bash
# 查看当前配置
openclaw config get

# 设置配置项
openclaw config set gateway.port 55443
openclaw config set models.default ollama/qwen3.5:9b

# 查看 Gateway 状态
openclaw gateway status

# 重启 Gateway
openclaw gateway restart
```

### 安全层管理

```bash
# 验证配置
node OpenClaw_Custom/example/check-status.mjs

# 开发环境控制
cd OpenClaw_Custom
node scripts/dev.mjs status
node scripts/dev.mjs start   # 启动（前台运行）
node scripts/dev.mjs stop    # 停止
node scripts/dev.mjs restart # 重启
```

---

## 故障排查

### 问题 1：模型无法加载

```bash
# 检查模型是否存在
ollama list

# 重新拉取模型
ollama pull qwen3.5:9b

# 检查 Ollama 服务
ollama ps
```

### 问题 2：配置未生效

```bash
# 1. 检查配置文件路径
echo $OPENCLAW_MODEL_SECURITY_CONFIG
ls -la ~/.openclaw/openclaw-custom/models-security.json5

# 2. 验证 JSON5 语法
node -e "require('json5').parse(require('fs').readFileSync('models-security.json5'))"

# 3. 重启 Gateway
openclaw gateway restart
```

### 问题 3：故障转移不工作

```bash
# 检查日志
tail -f ~/.openclaw/openclaw-custom/audit.log

# 验证故障转移链配置
cat ~/.openclaw/openclaw-custom/models-security.json5 | grep -A 20 'failover'
```

### 问题 4：显存不足

```bash
# 切换到轻量级模型
openclaw models set ollama/qwen3.5:0.8b

# 或关闭其他程序释放显存
```

### 问题 5：中文乱码

```powershell
# Windows
chcp 65001

# Linux/macOS
export LANG=zh_CN.UTF-8
```

### 问题 6：Token 配置问题

```bash
# 获取当前 token
Get-Content ~/.openclaw/openclaw.json | findstr "token"

# 生成新 token
$token = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
openclaw config set gateway.auth.token $token
```

---

## 附录

### 支持的模型提供商

| 提供商    | 标识符          | 区域   |
| --------- | --------------- | ------ |
| Ollama    | `ollama/*`    | local  |
| Moonshot  | `moonshot/*`  | cn     |
| Zhipu GLM | `zhipu/*`     | cn     |
| Anthropic | `anthropic/*` | global |
| OpenAI    | `openai/*`    | global |

### 配置文件模板位置

```
OpenClaw_Custom/config/
├── models-security.hybrid.json5    # 混合模型（推荐）
├── models-security.local.json5     # 纯本地
├── models-security.cn.json5        # 国内优先
└── models-security.qwen35.json5    # 纯 Qwen 3.5
```

### 相关文档

- [README.md](./README.md) - 项目总览
- [QUICKSTART.md](./QUICKSTART.md) - 从零开始运行指南
- [SECURITY_CONFIG.md](./SECURITY_CONFIG.md) - 安全端口配置
