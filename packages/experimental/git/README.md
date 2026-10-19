# @deepseek-ai/dsh-experimental-git

English | [中文](README.zh.md)

Experimental Git source control plugin for inspecting project repository status, file changes, unified diffs, and commit history.

## Features

- **Right Sidebar Panel**: Integrated `git` tab in the right sidebar. Displays current branch, ahead/behind counters, and HEAD commit info.
- **Working Tree Changes**: Clear grouping of staged changes, unstaged changes, and untracked files with status indicators (`M`, `A`, `D`, `U`).
- **Inline Unified Diff Viewer**: Click any changed file to view additions (+) and deletions (-) directly in the sidebar.
- **Commit History**: Browse recent commits with author, relative date, and hash badge.
- **Agent Tool**: Exposes `git_view` tool for model agents to query git status, logs, and diffs during conversations.
- **Shortcut**: Toggle the Git panel via `Ctrl+Shift+G` (or `Cmd+Shift+G` on macOS).

## Configuration

Enable the plugin via profile bundle or `cordis.patch.yml`:

```yaml
- id: optional-git
  name: '@deepseek-ai/dsh-experimental-git'
```
