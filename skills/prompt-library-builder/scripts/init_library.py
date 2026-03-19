#!/usr/bin/env python3
"""
Prompt Library Initializer
Creates a structured prompt library with all necessary files.
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path


def create_directory_structure(base_path: str) -> None:
    """Create the prompt library directory structure."""
    dirs = [
        "",
        "prompts",
        "versions"
    ]
    for d in dirs:
        path = Path(base_path) / d
        path.mkdir(parents=True, exist_ok=True)
        print(f"✓ Created directory: {path}")


def create_readme(base_path: str) -> None:
    """Create README.md"""
    content = '''# 智能提示词库

## 🎯 操作指令

| 指令 | 功能 |
|------|------|
| `【更新提示词库】` | 提取当前对话的可复用提示模式 |
| `【查看提示词库】` | 展示完整提示词列表 |
| `【删除提示词】ID` | 删除指定提示词 |
| `【推荐提示词】关键词` | 推荐匹配的提示词 |
| `【搜索提示词】关键词` | 按标签/内容搜索 |

## 📁 目录结构

```
prompt-library/
├── README.md           # 本文件
├── INDEX.md            # 提示词索引
├── registry.json       # 注册表
├── prompts/            # 提示词目录
└── versions/           # 版本历史
```

## 🔄 工作流程

### 更新提示词库
1. 发送 `【更新提示词库】`
2. 系统分析对话，提取可复用模式
3. 展示原文和优化版对比
4. 确认后入库

### 查看提示词库
发送 `【查看提示词库】` 查看所有已入库提示词

### 删除提示词
发送 `【删除提示词】PROMPT-XXX` 并确认

---

*创建时间: {date}*
'''.format(date=datetime.now().strftime('%Y-%m-%d'))
    
    path = Path(base_path) / "README.md"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ Created: {path}")


def create_index(base_path: str) -> None:
    """Create INDEX.md"""
    content = '''# 提示词库索引

> 最后更新: {date}

---

## 📊 统计

| 指标 | 数值 |
|------|------|
| 总提示词数 | 0 |
| 本月新增 | 0 |
| 本月使用 | 0 次 |

---

## 📚 提示词列表

| ID | 标题 | 版本 | 标签 | 使用次数 | 创建时间 |
|----|------|------|------|----------|----------|

---

*暂无提示词，发送【更新提示词库】开始添加*
'''.format(date=datetime.now().strftime('%Y-%m-%d'))
    
    path = Path(base_path) / "INDEX.md"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ Created: {path}")


def create_registry(base_path: str) -> None:
    """Create registry.json"""
    data = {
        "version": "1.0.0",
        "created": datetime.now().isoformat(),
        "lastUpdated": datetime.now().isoformat(),
        "totalCount": 0,
        "categories": {
            "创作类": ["小说", "文案", "剧本", "诗歌"],
            "开发类": ["代码", "审查", "调试", "重构"],
            "分析类": ["数据分析", "报告", "研究"],
            "营销类": ["SEO", "广告", "社媒", "转化"],
            "工作流": ["自动化", "模板", "批量"],
            "通用类": ["翻译", "总结", "问答"]
        },
        "prompts": []
    }
    
    path = Path(base_path) / "registry.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✓ Created: {path}")


def main():
    parser = argparse.ArgumentParser(description="Initialize a prompt library")
    parser.add_argument("--path", default="./prompt-library", help="Output directory path")
    args = parser.parse_args()
    
    print(f"\n🚀 Initializing prompt library at: {args.path}\n")
    
    create_directory_structure(args.path)
    create_readme(args.path)
    create_index(args.path)
    create_registry(args.path)
    
    print(f"\n✅ Prompt library initialized successfully!")
    print(f"   Location: {Path(args.path).absolute()}")
    print(f"\n📚 Next steps:")
    print(f"   1. Add prompts with 【更新提示词库】")
    print(f"   2. View library with 【查看提示词库】")


if __name__ == "__main__":
    main()
