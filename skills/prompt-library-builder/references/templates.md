# Prompt Templates Reference

Complete templates for prompt library files.

---

## Prompt File Template

```markdown
# [提示词标题]

## 元数据
- **ID**: PROMPT-XXX
- **版本**: vX.X
- **标签**: #标签1 #标签2 #标签3
- **适用场景**: [描述何时使用此提示词]
- **创建时间**: YYYY-MM-DD
- **最后更新**: YYYY-MM-DD
- **使用次数**: N次

---

## 原始提示词

```
[用户原始输入，保持原样不变]
```

---

## 优化版本

```
你是一位 [角色定位]。

## 任务目标
[明确描述需要完成什么]

## 输入要求
- 要求1
- 要求2
- 要求3

## 输出格式
[描述期望的输出格式]

## 质量标准
- 标准1
- 标准2

## 示例
[提供1-2个示例]

请开始执行。
```

---

## 优化说明

| 优化点 | 原文问题 | 优化方案 |
|--------|----------|----------|
| 角色定位 | 无 | 指定专业角色 |
| 结构化 | 无结构 | 分模块明确要求 |
| 输出格式 | 模糊 | 明确格式规范 |
| 示例 | 无 | 添加使用示例 |

---

## 使用示例

**用户输入**:
```
【使用提示词】PROMPT-XXX
[参数或具体需求]
```

**系统响应**:
```
基于 PROMPT-XXX 模板执行...
[执行结果]
```

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | YYYY-MM-DD | 初始版本 |
```

---

## Version History Template

`versions/PROMPT-XXX/history.json`:

```json
{
  "promptId": "PROMPT-XXX",
  "title": "[提示词标题]",
  "versions": [
    {
      "version": "1.0",
      "date": "YYYY-MM-DD",
      "type": "initial|minor|major",
      "changes": [
        "变更说明1",
        "变更说明2"
      ],
      "originalPrompt": "[原始用户输入]"
    }
  ],
  "currentVersion": "1.0"
}
```

---

## Registry Entry Template

添加到 `registry.json` 的 `prompts` 数组:

```json
{
  "id": "PROMPT-XXX",
  "title": "[提示词标题]",
  "version": "1.0",
  "tags": ["标签1", "标签2", "标签3"],
  "category": "[分类]",
  "created": "YYYY-MM-DD",
  "updated": "YYYY-MM-DD",
  "usageCount": 0,
  "originalPrompt": "[原始用户输入]",
  "summary": "[一句话描述此提示词的用途]"
}
```

---

## Optimization Patterns

### Pattern 1: Role + Task + Format

```
你是一位 [专业角色]。

任务: [具体任务]

要求:
- [要求1]
- [要求2]

输出格式:
[格式描述或模板]
```

### Pattern 2: Context + Action + Criteria

```
背景: [上下文信息]

需要完成的任务:
[任务描述]

验收标准:
- [标准1]
- [标准2]
```

### Pattern 3: Step-by-Step Workflow

```
请按以下步骤完成:

1. [第一步]
2. [第二步]
3. [第三步]

每个步骤的输出要求:
- 步骤1: [要求]
- 步骤2: [要求]
- 步骤3: [要求]
```

---

## Tag Guidelines

| 类别 | 建议标签 |
|------|----------|
| 创作类 | #小说 #文案 #剧本 #诗歌 #故事 |
| 开发类 | #代码 #审查 #调试 #重构 #API |
| 分析类 | #数据分析 #报告 #研究 #洞察 |
| 营销类 | #SEO #广告 #社媒 #转化 #文案 |
| 工作流 | #自动化 #模板 #批量 #流程 |
| 通用类 | #翻译 #总结 #问答 #解释 |
