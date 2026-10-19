/**
 * Localized copy for the Git right-sidebar viewer and commands.
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

export const NS = 'gitView'

export const zh = {
  'type.label': 'Git',
  'guide.title': 'Git 版本控制',
  'guide.description': '查看项目代码变更、分支、提交历史与差异对比',
  'shortcut.noSession': '没有激活的会话',
  'tabs.changes': '更改',
  'tabs.history': '提交历史',
  'actions.refresh': '刷新状态',
  'actions.viewDiff': '查看差异',
  'actions.closeDiff': '收起差异',
  'status.clean': '工作树干净，无任何未提交更改',
  'status.notRepo': '当前工作区不是 Git 仓库',
  'status.staged': '暂存的更改',
  'status.unstaged': '更改',
  'status.untracked': '未跟踪的文件',
  'status.ahead': '领先 {count} 个提交',
  'status.behind': '落后 {count} 个提交',
  'diff.additions': '+{count}',
  'diff.deletions': '-{count}',
  'diff.empty': '无内容变动',
} satisfies Record<string, string>

export type GitViewKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    gitView: GitViewKey
  }
}

export const en = {
  'type.label': 'Git',
  'guide.title': 'Git Source Control',
  'guide.description': 'View project code changes, branches, commit log, and unified diffs',
  'shortcut.noSession': 'No active session',
  'tabs.changes': 'Changes',
  'tabs.history': 'History',
  'actions.refresh': 'Refresh status',
  'actions.viewDiff': 'View Diff',
  'actions.closeDiff': 'Collapse Diff',
  'status.clean': 'Working tree clean, no uncommitted changes',
  'status.notRepo': 'Current workspace is not a Git repository',
  'status.staged': 'Staged Changes',
  'status.unstaged': 'Changes',
  'status.untracked': 'Untracked Files',
  'status.ahead': '{count} ahead',
  'status.behind': '{count} behind',
  'diff.additions': '+{count}',
  'diff.deletions': '-{count}',
  'diff.empty': 'No content changes',
} satisfies Record<GitViewKey, string>
