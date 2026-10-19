# @deepseek-ai/dsh-experimental-git

[English](README.md) | 中文

实验性 Git 版本控制查看插件，为开发者提供项目 Git 仓库状态、文件变更、代码差异比对（Diff）与提交历史查看功能。

## Features

- **右侧边栏直观展示**：在右侧边栏集成 `git` 标签页。顶部显示当前所在分支、领先/落后提交数以及最新提交说明。
- **工作区变更列表**：分组展示已暂存更改、未暂存更改与未跟踪文件，带有状态标记（`M`、`A`、`D`、`U`）。
- **内联差异查看器**：点击任意修改文件，直接在侧边栏中查看统一差异对比（+ 新增，- 删除）。
- **提交历史记录**：浏览最近的 Commit 历史（提交说明、作者、相对时间以及短 Commit Hash 徽章）。
- **AI 智能体工具**：提供 `git_view` 模型工具，允许智能体在对话中直接查询仓库状态、日志与差异。
- **全局快捷键**：支持使用快捷键 `Ctrl+Shift+G`（macOS 上为 `Cmd+Shift+G`）快速打开或聚焦右侧 Git 面板。

## Configuration

在 profile bundle 或 `cordis.patch.yml` 中启用该插件：

```yaml
- id: optional-git
  name: '@deepseek-ai/dsh-experimental-git'
```
