# OpenClaw_Custom 文档索引

## 核心文档

| 文档 | 说明 |
|------|------|
| [USER_GUIDE.md](../USER_GUIDE.md) | **用户完全指南**（安装、配置、使用、故障排查） |
| [MODEL_CONFIGURATION.md](../MODEL_CONFIGURATION.md) | 大模型配置完全指南 |
| [README.md](../README.md) | 项目总览和介绍 |

## 配置参考

| 文档 | 说明 |
|------|------|
| [TOKEN_SETUP.md](./TOKEN_SETUP.md) | Gateway Token 配置详细说明 |

## 配置模板

```
config/
├── models-security.hybrid.json5    # 混合模型（本地→国内→国际）⭐ 推荐
├── models-security.local.json5     # 纯本地模型
├── models-security.cn.json5        # 国内优先
└── models-security.qwen35.json5    # 纯 Qwen 3.5
```

## 快速开始

```powershell
# 1. 查看用户指南
cat USER_GUIDE.md

# 2. 快速启动
cd OpenClaw_Custom
node scripts/dev.mjs start

# 3. 浏览器访问
# http://127.0.0.1:55443/
```
