# OpenClaw_Custom - 安全隔离层

[![Security](https://img.shields.io/badge/Security-Hardened-brightgreen.svg)]()
[![Zero Intrusion](https://img.shields.io/badge/Intrusion-Zero-blue.svg)]()
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)]()

**OpenClaw_Custom** 是为 OpenClaw 项目开发的零侵入安全隔离层，通过模块Hook系统和依赖注入容器，在不修改原始源码的情况下修复安全漏洞。

> 📖 **用户指南**: 查看 [USER_GUIDE.md](USER_GUIDE.md) 获取完整的安装、配置和使用指南
>
> 🤖 **模型配置**: 查看 [MODEL_CONFIGURATION.md](MODEL_CONFIGURATION.md) 获取大模型配置指南
>
> 💡 **开发环境**: 使用 `node scripts/dev.mjs start` 启动（前台运行，Ctrl+C 停止）

---

## 🎯 核心特性

### 安全修复

| 漏洞ID | 严重程度 | 描述 | 状态 |
|--------|----------|------|------|
| OC-001 | 🔴 Critical | WebSocket Origin绕过 | ✅ 已修复 |
| OC-002 | 🔴 Critical | 命令执行RCE | ✅ 已修复 |
| OC-003 | 🔴 Critical | 凭证明文存储 | ✅ 已修复 |
| OC-006 | 🟠 High | Skill供应链攻击 | ✅ 已修复 |
| OC-007 | 🟠 High | 静态扫描绕过 | ✅ 已修复 |

### 架构特性

- **零侵入原则**: 所有代码位于 `OpenClaw_Custom/` 目录，不修改原项目
- **可升级性**: `git pull` 更新后只需重新挂载即可生效
- **可回滚**: 任何修改可随时撤销，不影响原系统
- **依赖注入**: 基于DI容器的设计，便于测试和维护

---

## 📦 安装

### 环境要求

- Node.js >= 22.0.0
- OpenClaw 已安装

### 快速安装

#### Windows

```powershell
# 1. 安装依赖
pnpm install

# 2. 编译
npx tsc

# 3. 注入安全层到 OpenClaw
scripts\inject-security-layer.ps1
```

#### Linux/macOS

```bash
npm install
npm run build
npm test
```

### 验证安装

```bash
# Windows
node scripts\dev.mjs status

# Linux/macOS
bash scripts/verify.sh
```

---

## 🚀 使用

### 开发环境（推荐）

使用 `dev.mjs` 脚本轻松控制 Gateway（随时启停）

```powershell
# 查看状态
node scripts/dev.mjs status

# 启动 Gateway（前台运行，按 Ctrl+C 停止）
node scripts/dev.mjs start

# 停止 Gateway
node scripts/dev.mjs stop

# 重启 Gateway
node scripts/dev.mjs restart
```

**首次使用需配置 Token**

```powershell
# 1. 获取 token（从配置文件查看，因为命令行会隐藏）
Get-Content ~/.openclaw/openclaw.json | findstr "token"

# 2. 浏览器访问并输入 token
# http://127.0.0.1:55443/
```

**特点**：
- ✅ 前台运行，实时查看日志
- ✅ 按 `Ctrl+C` 随时停止
- ✅ 自动使用安全端口 55443（避开默认 18789）
- ✅ 自动加载安全层

### 基本用法

```typescript
import { initialize, shutdown } from 'openclaw-custom';

// 初始化安全层
await initialize({
  autoMount: true,           // 自动挂载Hook
  migrateCredentials: true,   // 迁移明文凭证
  debug: false               // 调试模式
});

// 安全层已激活，OpenClaw运行在安全沙箱中
// ... 运行OpenClaw应用 ...

// 关闭安全层
await shutdown();
```

### 高级配置

```typescript
import { OpenClawCustomBootstrap } from 'openclaw-custom';

const bootstrap = new OpenClawCustomBootstrap({
  config: {
    websocket: {
      allowedOrigins: ['https://myapp.com'],
      tokenBinding: true,
      ipBinding: true
    },
    skills: {
      staticAnalysis: true,
      behaviorTesting: true,
      sandboxInstall: true
    },
    storage: {
      type: 'encrypted-file',
      storageDir: '~/.openclaw/secure'
    }
  }
});

await bootstrap.initialize();
```

---

## 🏗️ 项目结构

```
OpenClaw_Custom/
├── src/
│   ├── core/
│   │   ├── di/              # 依赖注入容器
│   │   │   ├── container.ts
│   │   │   └── tokens.ts
│   │   └── interfaces/      # 核心接口定义
│   │       ├── auth.ts
│   │       ├── sandbox.ts
│   │       ├── security.ts
│   │       └── storage.ts
│   ├── decorators/
│   │   ├── security/        # 安全装饰器
│   │   │   ├── origin-validator.ts    # OC-001
│   │   │   └── rate-limiter.ts
│   │   └── proxy/           # 代理装饰器
│   │       └── execution-proxy.ts     # OC-002
│   ├── hooks/               # 模块Hook系统
│   │   ├── module-hooks.ts
│   │   └── exec-hooks.ts
│   ├── mitigations/         # 安全缓解措施
│   │   ├── oc003-credential-encryption.ts
│   │   └── oc006-skill-sandbox.ts
│   ├── strategies/
│   │   ├── credential-storage/  # 凭证存储策略
│   │   │   ├── keyring-storage.ts
│   │   │   └── encrypted-file.ts
│   │   └── sandbox/         # 沙箱策略
│   │       └── docker-sandbox.ts
│   ├── utils/
│   │   └── secure-string.ts
│   ├── bootstrap.ts         # 启动引导
│   └── index.ts             # 入口文件
├── tests/
│   ├── unit/                # 单元测试
│   ├── security/            # 安全测试
│   └── integration/         # 集成测试
├── scripts/
│   ├── dev.mjs              # 🔧 开发环境控制（推荐）
│   ├── dev-start.ps1        # PowerShell 启动脚本
│   ├── dev-stop.ps1         # PowerShell 停止脚本
│   ├── dev-status.ps1       # PowerShell 状态脚本
│   ├── inject-security-layer.ps1  # 注入安全层
│   ├── build-windows.ps1    # Windows 构建脚本
│   ├── env-config.ps1       # 生成环境配置
│   └── setup-firewall.ps1   # 防火墙配置
├── example/
│   ├── check-status.mjs     # 状态检查
│   ├── run-local.mjs        # 本地运行示例
│   └── start-secure-port.mjs # 安全端口启动
├── docs/
│   ├── README.md            # 文档索引
│   └── TOKEN_SETUP.md       # Token 配置指南
├── MODEL_CONFIGURATION.md   # 大模型配置完全指南 ⭐
├── USER_GUIDE.md            # 用户完全指南（安装、配置、使用）
└── README.md                # 项目总览
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🧪 测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试

```bash
# 单元测试
npm test -- tests/unit

# 安全测试
npm test -- tests/security

# 集成测试
npm test -- tests/integration
```

### 代码覆盖率

```bash
npm run test:coverage
```

---

## 🔒 安全缓解措施详情

### OC-001: WebSocket Origin验证

**威胁**: WebSocket连接缺乏严格的Origin验证，可能遭受跨站WebSocket劫持攻击。

**修复**: 
- 实现严格的白名单Origin验证
- Token与Origin绑定验证
- IP地址绑定支持
- 连接速率限制

```typescript
const validator = new StrictOriginValidator({
  allowedOrigins: ['https://trusted.com'],
  tokenBindingEnabled: true
});

const result = await validator.validate(connectionRequest);
```

### OC-002: 命令执行沙箱

**威胁**: 命令执行功能缺乏沙箱隔离，可能导致RCE攻击。

**修复**:
- 命令解析与风险评估
- 危险模式检测
- Docker沙箱执行
- 审计日志记录

```typescript
const proxy = new SecureExecutionProxy(dockerSandbox);
const result = await proxy.execute('npm install', context);
```

### OC-003: 凭证加密存储

**威胁**: 凭证明文存储在配置文件中，存在泄露风险。

**修复**:
- AES-256-GCM加密
- 系统密钥环集成
- 安全内存管理
- 自动迁移工具

```typescript
const secure = await SecureString.fromPlaintext('api-key');
await storage.store('openai-key', secure);
```

### OC-006: Skill安全扫描

**威胁**: Skill安装缺乏安全验证，可能遭受供应链攻击。

**修复**:
- 多维度静态分析
- 行为沙箱测试
- 依赖安全扫描
- 隔离安装流程

```typescript
const hardening = new SkillSandboxHardening(sandbox);
const result = await hardening.installSkill(skillSpec);
```

---

## 📚 API文档

### DI容器

```typescript
import { DIContainer, Lifetime, createToken } from 'openclaw-custom';

const container = new DIContainer();
const MyServiceToken = createToken<MyService>('MyService');

container.register(MyServiceToken, MyService, Lifetime.Singleton);
const service = container.resolve(MyServiceToken);
```

### Hook系统

```typescript
import { ModuleHookSystem, WebSocketInterceptor } from 'openclaw-custom';

const hooks = new ModuleHookSystem();
hooks.registerInterceptor(
  /websocket/,
  new WebSocketInterceptor(config)
);
hooks.install();
```

---

## 🤝 贡献

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

---

## 🙏 致谢

- OpenClaw 项目团队
- 安全研究社区

---

**注意**: 本项目是安全增强层，应与OpenClaw主项目配合使用。生产环境部署前请进行全面测试。
