---
name: prompt-library-builder
description: "Build and manage a structured prompt library system with version control, user confirmation, and smart retrieval. Use when: (1) Setting up a new prompt library from scratch, (2) Adding prompts to existing library with 【更新提示词库】, (3) Viewing library with 【查看提示词库】, (4) Deleting prompts with 【删除提示词】, (5) Getting recommendations with 【推荐提示词】 or 【搜索提示词】. Triggers on phrases like '提示词库', 'prompt library', '创建提示词库', '管理提示词'."
---

# Prompt Library Builder

Build and manage an intelligent prompt library with structured storage, version control, and smart retrieval.

## Quick Reference

| Command | Action |
|---------|--------|
| `【更新提示词库】` | Extract reusable prompt patterns from current conversation |
| `【查看提示词库】` | Display all prompts with version and usage info |
| `【删除提示词】ID` | Safely delete a prompt after confirmation |
| `【推荐提示词】关键词` | Recommend matching prompts based on context |
| `【搜索提示词】关键词` | Search prompts by tag/content |

---

## Directory Structure

```
prompt-library/
├── README.md           # User guide
├── INDEX.md            # Quick index
├── registry.json       # Metadata registry
├── prompts/            # Prompt files
│   └── PROMPT-XXX.md
└── versions/           # Version history
    └── PROMPT-XXX/
        ├── v1.0.md
        └── history.json
```

---

## Workflow

### Initialize New Library

1. Create directory structure:
```
prompt-library/
├── prompts/
└── versions/
```

2. Create core files from templates in `assets/`:
   - Copy `assets/README.md` → `prompt-library/README.md`
   - Copy `assets/INDEX.md` → `prompt-library/INDEX.md`
   - Copy `assets/registry.json` → `prompt-library/registry.json`

Or run the init script:
```bash
python scripts/init_library.py --path ./prompt-library
```

### Add New Prompt (【更新提示词库】)

1. Analyze conversation for reusable patterns
2. Extract original user input
3. Generate optimized version with:
   - Role definition
   - Structured requirements
   - Output format specification
   - Examples

4. Display comparison:
```
┌─────────────────────────────────────┐
│ 📥 提示词提取分析                    │
├─────────────────────────────────────┤
│ 📄 原文: [original input]            │
│ ✨ 优化版: [optimized version]       │
│ 📝 优化说明: [improvement notes]     │
│ 确认入库？[是/否/修改]              │
└─────────────────────────────────────┘
```

5. On user confirmation:
   - Create `prompts/PROMPT-XXX.md` using template
   - Create `versions/PROMPT-XXX/v1.0.md`
   - Create `versions/PROMPT-XXX/history.json`
   - Update `registry.json`
   - Update `INDEX.md`

### View Library (【查看提示词库】)

Read `INDEX.md` and format as table:
```
| ID | 标题 | 版本 | 标签 | 使用次数 | 创建时间 |
|----|------|------|------|----------|----------|
```

### Delete Prompt (【删除提示词】ID)

1. Show confirmation with prompt details
2. On confirmation:
   - Remove from `registry.json`
   - Remove from `INDEX.md`
   - Delete `prompts/PROMPT-XXX.md`
   - Keep `versions/PROMPT-XXX/` for history

### Search/Recommend (【推荐提示词】/【搜索提示词】)

Search `registry.json` for matching:
- Tags
- Title
- Summary
- Category

Return ranked results.

---

## Prompt File Format

See `references/templates.md` for complete prompt template.

Key sections:
- **Metadata**: ID, version, tags, usage count
- **Original Prompt**: User's raw input
- **Optimized Version**: Engineered prompt
- **Optimization Notes**: What was improved
- **Usage Example**: How to use
- **Version History**: Changelog

---

## Quality Standards

Before adding a prompt, verify:
- [ ] Original input preserved exactly
- [ ] Optimized version is structured
- [ ] Tags are accurate
- [ ] Usage example provided
- [ ] Optimization notes specific

---

## Version Management

- Minor improvements: `v1.0` → `v1.1`
- Major refactoring: `v1.0` → `v2.0`
- Always preserve original in versions/

---

## Integration

Add to `AGENTS.md`:
```markdown
## 📚 智能提示词库
位置: `prompt-library/`
操作: 【更新提示词库】【查看提示词库】等
```
