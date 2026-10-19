/**
 * Interactive Git right-sidebar viewer component.
 * Allows developers to view working tree changes, inspect diffs, and browse commit history.
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  GitCommitItem,
  GitDiffSummary,
  GitFileStatus,
  GitStatusSummary,
} from '../types.ts'
import type {} from './locales.ts'
import css from './GitBody.module.css'

/** Injected Git RPC methods */
export interface GitInjected {
  readonly getStatus: (sessionId?: string) => Promise<GitStatusSummary>
  readonly getLog: (sessionId?: string, maxCount?: number) => Promise<readonly GitCommitItem[]>
  readonly getDiff: (sessionId?: string, options?: { filePath?: string; staged?: boolean; commit?: string }) => Promise<GitDiffSummary>
}

export type GitBodyProps =
  & PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<'gitView'>
  & GitInjected

/**
 * Render color-coded unified diff text lines.
 * @param props - Raw diff text.
 * @returns Formatted React element.
 */
function DiffViewer({ diffText }: { readonly diffText: string }): ReactElement {
  if (!diffText.trim()) {
    return <div className={css.diffLoading}>No diff changes</div>
  }

  const lines = diffText.split('\n')
  return (
    <div className={css.diffPreview}>
      {lines.map((line, idx) => {
        let lineClass = css.diffLine
        if (line.startsWith('+') && !line.startsWith('+++')) {
          lineClass = `${css.diffLine} ${css.diffLineAdd}`
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          lineClass = `${css.diffLine} ${css.diffLineDel}`
        } else if (line.startsWith('@@')) {
          lineClass = `${css.diffLine} ${css.diffLineHeader}`
        }
        return (
          <div key={idx} className={lineClass}>
            {line || ' '}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Main Git right-sidebar tab body.
 * @param props - Slot props including RPC actions and locale translator.
 * @returns Tab content JSX element.
 */
export function GitBody(props: GitBodyProps): ReactElement {
  const { t, getStatus, getLog, getDiff } = props

  const [activeTab, setActiveTab] = useState<'changes' | 'history'>('changes')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<GitStatusSummary | null>(null)
  const [commits, setCommits] = useState<readonly GitCommitItem[]>([])
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [fileDiffs, setFileDiffs] = useState<Record<string, string>>({})
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null)
  const [commitDiffs, setCommitDiffs] = useState<Record<string, string>>({})

  // Fetch status and commits
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const currentStatus = await getStatus()
      setStatus(currentStatus)
      if (currentStatus.isRepo) {
        const commitHistory = await getLog(undefined, 30)
        setCommits(commitHistory)
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false)
    }
  }, [getStatus, getLog])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Toggle diff expansion for a file
  const toggleFileDiff = async (file: GitFileStatus) => {
    const key = `${file.staged ? 'staged:' : 'unstaged:'}${file.path}`
    if (expandedFile === key) {
      setExpandedFile(null)
      return
    }

    setExpandedFile(key)
    if (!fileDiffs[key]) {
      setLoadingDiff(true)
      try {
        const diff = await getDiff(undefined, {
          filePath: file.path,
          staged: file.staged,
        })
        setFileDiffs(prev => ({ ...prev, [key]: diff.rawDiff }))
      } catch {
        setFileDiffs(prev => ({ ...prev, [key]: 'Error loading diff.' }))
      } finally {
        setLoadingDiff(false)
      }
    }
  }

  // Toggle diff expansion for a commit
  const toggleCommitDiff = async (hash: string) => {
    if (expandedCommit === hash) {
      setExpandedCommit(null)
      return
    }

    setExpandedCommit(hash)
    if (!commitDiffs[hash]) {
      try {
        const diff = await getDiff(undefined, { commit: hash })
        setCommitDiffs(prev => ({ ...prev, [hash]: diff.rawDiff }))
      } catch {
        setCommitDiffs(prev => ({ ...prev, [hash]: 'Error loading commit diff.' }))
      }
    }
  }

  // Render a list of files with their status badge and collapsible diff
  const renderFileList = (files: readonly GitFileStatus[], isStaged = false) => {
    return (
      <div className={css.fileList}>
        {files.map((file) => {
          const key = `${isStaged ? 'staged:' : 'unstaged:'}${file.path}`
          const isExpanded = expandedFile === key

          let badgeClass = css.statusModified
          let badgeLetter = 'M'
          if (file.status === 'added') {
            badgeClass = css.statusAdded
            badgeLetter = 'A'
          } else if (file.status === 'deleted') {
            badgeClass = css.statusDeleted
            badgeLetter = 'D'
          } else if (file.status === 'untracked') {
            badgeClass = css.statusUntracked
            badgeLetter = 'U'
          }

          const lastSlash = file.path.lastIndexOf('/')
          const fileName = lastSlash !== -1 ? file.path.slice(lastSlash + 1) : file.path
          const dirPath = lastSlash !== -1 ? file.path.slice(0, lastSlash) : ''

          return (
            <div key={key} className={`${css.fileItem} ${isExpanded ? css.selected : ''}`}>
              <div
                className={css.fileRow}
                onClick={() => void toggleFileDiff(file)}
                title={`${file.path} (${file.status})`}
              >
                <div className={css.fileMain}>
                  <span className={`${css.statusBadge} ${badgeClass}`}>{badgeLetter}</span>
                  <span className={css.filePath}>
                    <span className={css.fileName}>{fileName}</span>
                    {dirPath && <span className={css.fileDir}>{dirPath}</span>}
                  </span>
                </div>
              </div>
              {isExpanded && (
                loadingDiff && !fileDiffs[key]
                  ? <div className={css.diffLoading}>Loading diff...</div>
                  : <DiffViewer diffText={fileDiffs[key] ?? ''} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const isRepo = status?.isRepo ?? false
  const totalChanges = status?.totalChanges ?? 0

  return (
    <div className={css.root}>
      {/* Header bar */}
      <div className={css.header}>
        <div className={css.branchInfo}>
          {isRepo ? (
            <span className={css.branchBadge} title={status?.branch}>
              <svg className={css.branchIcon} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0z" />
              </svg>
              {status?.branch ?? 'HEAD'}
            </span>
          ) : (
            <span className={css.branchBadge}>Not a Git Repo</span>
          )}
          {status && status.ahead > 0 && (
            <span className={css.tabCount} title={`Ahead by ${status.ahead}`}>↑{status.ahead}</span>
          )}
          {status && status.behind > 0 && (
            <span className={css.tabCount} title={`Behind by ${status.behind}`}>↓{status.behind}</span>
          )}
        </div>

        <div className={css.headerActions}>
          <button
            type="button"
            className={`${css.iconButton} ${loading ? css.spinning : ''}`}
            onClick={() => void refresh()}
            title={t('actions.refresh')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.705 8.001a6.3 6.3 0 0 1 10.37-4.807l-1.077 1.076a.5.5 0 0 0 .354.854h3.5a.5.5 0 0 0 .5-.5V1.124a.5.5 0 0 0-.854-.353l-1.128 1.127A7.3 7.3 0 1 0 8 15.3a7.27 7.27 0 0 0 6.136-3.327.5.5 0 1 0-.85-.526A6.27 6.27 0 0 1 8 14.3a6.3 6.3 0 0 1-6.295-6.299z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={css.tabBar}>
        <button
          type="button"
          className={`${css.tabItem} ${activeTab === 'changes' ? css.active : ''}`}
          onClick={() => setActiveTab('changes')}
        >
          {t('tabs.changes')}
          {totalChanges > 0 && <span className={css.tabCount}>{totalChanges}</span>}
        </button>
        <button
          type="button"
          className={`${css.tabItem} ${activeTab === 'history' ? css.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          {t('tabs.history')}
          {commits.length > 0 && <span className={css.tabCount}>{commits.length}</span>}
        </button>
      </div>

      {/* Body content */}
      <div className={css.body}>
        {!isRepo ? (
          <div className={css.emptyState}>
            <svg className={css.emptyIcon} width="36" height="36" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
              <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
            </svg>
            <div className={css.emptyText}>{t('status.notRepo')}</div>
          </div>
        ) : activeTab === 'changes' ? (
          totalChanges === 0 ? (
            <div className={css.emptyState}>
              <svg className={css.emptyIcon} width="36" height="36" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
              </svg>
              <div className={css.emptyText}>{t('status.clean')}</div>
            </div>
          ) : (
            <>
              {/* Staged Changes */}
              {status && status.staged.length > 0 && (
                <div className={css.section}>
                  <div className={css.sectionHeader}>
                    <span className={css.sectionTitle}>
                      {t('status.staged')} ({status.staged.length})
                    </span>
                  </div>
                  {renderFileList(status.staged, true)}
                </div>
              )}

              {/* Unstaged Changes */}
              {status && status.unstaged.length > 0 && (
                <div className={css.section}>
                  <div className={css.sectionHeader}>
                    <span className={css.sectionTitle}>
                      {t('status.unstaged')} ({status.unstaged.length})
                    </span>
                  </div>
                  {renderFileList(status.unstaged, false)}
                </div>
              )}

              {/* Untracked Files */}
              {status && status.untracked.length > 0 && (
                <div className={css.section}>
                  <div className={css.sectionHeader}>
                    <span className={css.sectionTitle}>
                      {t('status.untracked')} ({status.untracked.length})
                    </span>
                  </div>
                  {renderFileList(status.untracked, false)}
                </div>
              )}
            </>
          )
        ) : (
          /* History View */
          <div className={css.commitList}>
            {commits.map((commit) => {
              const isExpanded = expandedCommit === commit.hash
              return (
                <div
                  key={commit.hash}
                  className={css.commitItem}
                  onClick={() => void toggleCommitDiff(commit.hash)}
                >
                  <div className={css.commitHeader}>
                    <div className={css.commitSubject}>{commit.subject}</div>
                    <span className={css.commitHash}>{commit.shortHash}</span>
                  </div>
                  <div className={css.commitMeta}>
                    <span>{commit.author}</span>
                    <span>{commit.relativeDate}</span>
                  </div>
                  {isExpanded && (
                    commitDiffs[commit.hash]
                      ? <DiffViewer diffText={commitDiffs[commit.hash] ?? ''} />
                      : <div className={css.diffLoading}>Loading commit diff...</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
