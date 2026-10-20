/**
 * Status bar Git branch pill and popover branch switcher (IDEA / VS Code style).
 * Injected into the 'conversation.composer.dock' slot at order: -1.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { GitBranchesSummary, GitStatusSummary } from '../types.ts'
import css from './GitBranchPill.module.css'

/** SVG Git Branch Icon */
function GitBranchIcon({ className }: { className?: string | undefined }) {
  return (
    <svg className={className ?? ''} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M11.75 2.5a1.75 1.75 0 1 0-2.45 1.606V6.5a1.5 1.5 0 0 1-1.5 1.5H5.8A2.75 2.75 0 0 0 3.5 6.25V4.106a1.75 1.75 0 1 0-1.5 0v7.788a1.75 1.75 0 1 0 1.5 0V8.25A1.25 1.25 0 0 1 4.75 7h3a3 3 0 0 0 3-3V4.106a1.75 1.75 0 0 0 1-1.606zM2.75 3.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm8-10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
    </svg>
  )
}

/** Checkmark icon */
function CheckIcon({ className }: { className?: string | undefined }) {
  return (
    <svg className={className ?? ''} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
    </svg>
  )
}


export interface GitBranchPillProps {
  getStatus?: ((sessionId?: string) => Promise<GitStatusSummary>) | undefined
  getBranches?: ((sessionId?: string) => Promise<GitBranchesSummary>) | undefined
  checkout?: (
    (sessionId: string | undefined, branch: string, create?: boolean) => Promise<{ success: boolean; message?: string }>
  ) | undefined
  pull?: ((sessionId?: string) => Promise<{ success: boolean; message?: string }>) | undefined
  push?: ((sessionId?: string) => Promise<{ success: boolean; message?: string }>) | undefined
  sessionId?: string | undefined
}

/**
 * Git Branch Pill rendered in the Composer Dock.
 */
export const GitBranchPill = memo(function GitBranchPill({
  getStatus,
  getBranches,
  checkout,
  pull,
  push,
  sessionId,
}: GitBranchPillProps) {
  const [status, setStatus] = useState<GitStatusSummary | null>(null)
  const [branches, setBranches] = useState<GitBranchesSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [switching, setSwitching] = useState(false)

  const anchorRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverPos, setPopoverPos] = useState<{ bottom: number; left: number } | null>(null)

  // Fetch status and branches from injected actions
  const refresh = useCallback(async () => {
    if (!getStatus || !getBranches) return

    try {
      const [statusRes, branchRes] = await Promise.all([
        getStatus(sessionId),
        getBranches(sessionId),
      ])
      if (statusRes) setStatus(statusRes)
      if (branchRes) setBranches(branchRes)
    } catch {
      // safe fallback on communication errors
    }
  }, [getStatus, getBranches, sessionId])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, 5000)
    return () => { clearInterval(timer) }
  }, [refresh])

  // Recalculate popover position relative to anchor button
  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPopoverPos({
      bottom: window.innerHeight - rect.top + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 330)),
    })
  }, [])

  const handleToggle = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    if (!open) {
      updatePosition()
      void refresh()
    }
    setOpen(prev => !prev)
    setCreatingBranch(false)
    setFilter('')
  }, [open, refresh, updatePosition])

  // Dismiss popover on outside click or escape
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Checkout branch
  const handleCheckout = useCallback(async (branchName: string, create = false) => {
    if (!checkout || switching) return

    setSwitching(true)
    try {
      const res = await checkout(sessionId, branchName, create)
      if (res.success) {
        setOpen(false)
        setCreatingBranch(false)
        setNewBranchName('')
        await refresh()
      } else {
        alert(res.message ?? 'Checkout failed')
      }
    } finally {
      setSwitching(false)
    }
  }, [checkout, refresh, sessionId, switching])

  // Create new branch
  const handleCreateBranchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = newBranchName.trim()
      if (trimmed) void handleCheckout(trimmed, true)
    } else if (e.key === 'Escape') {
      setCreatingBranch(false)
    }
  }, [handleCheckout, newBranchName])

  // Pull
  const handlePull = useCallback(async () => {
    if (!pull) return
    await pull(sessionId)
    await refresh()
  }, [pull, refresh, sessionId])

  // Push
  const handlePush = useCallback(async () => {
    if (!push) return
    await push(sessionId)
    await refresh()
  }, [push, refresh, sessionId])

  // Filtered branches
  const filteredLocal = useMemo(() => {
    if (!branches?.local) return []
    const q = filter.trim().toLowerCase()
    return q ? branches.local.filter(b => b.name.toLowerCase().includes(q)) : branches.local
  }, [branches?.local, filter])

  const filteredRemote = useMemo(() => {
    if (!branches?.remote) return []
    const q = filter.trim().toLowerCase()
    return q ? branches.remote.filter(b => b.name.toLowerCase().includes(q)) : branches.remote
  }, [branches?.remote, filter])

  if (status && !status.isRepo) {
    return null
  }

  const currentBranchName = status?.branch || 'master'

  return (
    <span ref={anchorRef} className={css.anchor} data-composer-stat="git-branch">
      <button
        type="button"
        className={css.pill}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Git Branch: ${currentBranchName}`}
        onClick={handleToggle}
      >
        <GitBranchIcon className={css.icon} />
        <span className={css.branchName}>{currentBranchName}</span>
        {status !== null && status.ahead > 0 && <span className={`${css.badge} ${css.badgeAhead}`}>↑{status.ahead}</span>}
        {status !== null && status.behind > 0 && <span className={`${css.badge} ${css.badgeBehind}`}>↓{status.behind}</span>}
      </button>

      {open && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className={css.popover}
          style={{ bottom: `${popoverPos.bottom}px`, left: `${popoverPos.left}px` }}
        >
          <div className={css.header}>
            <div className={css.searchRow}>
              <svg className={css.searchIcon} viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.5 7a4.499 4.499 0 1 1-8.998 0A4.499 4.499 0 0 1 11.5 7zm-.82 4.74a6 6 0 1 0-1.06 1.06l3.04 3.04a.75.75 0 1 0 1.06-1.06l-3.04-3.04z" />
              </svg>
              <input
                autoFocus
                className={css.searchInput}
                placeholder="搜索或过滤分支..."
                value={filter}
                onChange={(e) => { setFilter(e.target.value) }}
              />
            </div>

            <div className={css.actionBar}>
              <button
                type="button"
                className={css.toolBtn}
                title="新建分支"
                onClick={() => { setCreatingBranch(prev => !prev) }}
              >
                + 新建分支
              </button>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className={css.toolBtn} title="拉取 (Pull)" onClick={handlePull}>
                  ↓ Pull
                </button>
                <button type="button" className={css.toolBtn} title="推送 (Push)" onClick={handlePush}>
                  ↑ Push
                </button>
                <button type="button" className={css.toolBtn} title="刷新状态" onClick={refresh}>
                  🔄 刷新
                </button>
              </div>
            </div>

            {creatingBranch && (
              <div className={css.newBranchBox}>
                <input
                  autoFocus
                  className={css.newBranchInput}
                  placeholder="新分支名称 (按 Enter 创建)..."
                  value={newBranchName}
                  onChange={(e) => { setNewBranchName(e.target.value) }}
                  onKeyDown={handleCreateBranchKeyDown}
                />
              </div>
            )}
          </div>

          <div className={css.branchList}>
            {/* Local Branches */}
            <div className={css.groupLabel}>本地分支 ({filteredLocal.length})</div>
            {filteredLocal.map(b => (
              <button
                key={b.name}
                type="button"
                className={`${css.branchItem} ${b.isCurrent ? css.currentBranch : ''}`}
                disabled={switching}
                onClick={() => {
                  if (!b.isCurrent) void handleCheckout(b.name)
                }}
              >
                <div className={css.branchItemLeft}>
                  <GitBranchIcon className={css.itemIcon} />
                  <span className={css.itemText}>{b.name}</span>
                </div>
                {b.isCurrent ? (
                  <CheckIcon className={css.checkMark} />
                ) : (
                  b.ahead !== undefined && b.ahead > 0 && <span className={css.badge}>↑{b.ahead}</span>
                )}
              </button>
            ))}

            {/* Remote Branches */}
            {filteredRemote.length > 0 && (
              <>
                <div className={css.groupLabel} style={{ marginTop: '6px' }}>
                  远程分支 ({filteredRemote.length})
                </div>
                {filteredRemote.map(b => (
                  <button
                    key={b.name}
                    type="button"
                    className={css.branchItem}
                    disabled={switching}
                    onClick={() => { void handleCheckout(b.name) }}
                  >
                    <div className={css.branchItemLeft}>
                      <GitBranchIcon className={css.itemIcon} />
                      <span className={css.itemText}>{b.name}</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {filteredLocal.length === 0 && filteredRemote.length === 0 && (
              <div className={css.emptyTip}>未找到匹配的分支</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
})
