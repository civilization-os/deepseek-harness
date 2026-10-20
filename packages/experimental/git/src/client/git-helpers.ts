/**
 * Conventional Commits and presentation helpers for Git commits and avatars.
 */

export type ConventionalType =
  | 'feat'
  | 'fix'
  | 'style'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'chore'
  | 'release'
  | 'merge'
  | 'revert'

export interface ParsedCommitSubject {
  readonly type?: ConventionalType
  readonly scope?: string
  readonly cleanSubject: string
}

/**
 * Parse conventional commit prefix from a commit subject.
 * @param subject - Raw first line of commit message.
 * @returns Parsed type, scope, and clean subject.
 */
export function parseConventionalCommit(subject: string): ParsedCommitSubject {
  const trimmed = subject.trim()

  // Match merge commits
  if (/^merge\s+(pull\s+request|branch|remote-tracking\s+branch)/i.test(trimmed)) {
    return {
      type: 'merge',
      cleanSubject: trimmed,
    }
  }

  // Match standard conventional commit prefix: "type(scope): message" or "type: message"
  const match = /^(feat|fix|style|refactor|docs|test|chore|release|revert)(?:\(([^)]+)\))?!?:\s*(.*)$/i.exec(trimmed)
  if (match && match[1]) {
    const rawType = match[1].toLowerCase() as ConventionalType
    const scope = match[2]?.trim()
    return {
      type: rawType,
      ...scope !== undefined ? { scope } : {},
      cleanSubject: trimmed,
    }
  }

  return {
    cleanSubject: trimmed,
  }
}

const AVATAR_PALETTE = [
  '#388bfd', // Blue
  '#2ea043', // Green
  '#f0883e', // Orange
  '#a371f7', // Purple
  '#db61a2', // Rose
  '#39c5bb', // Cyan
  '#f9c513', // Amber
  '#6f42c1', // Violet
]

/**
 * Deterministically compute avatar initial and background color for an author name.
 * @param author - Author name or email.
 * @returns Initial letter and hex color code.
 */
export function getAuthorAvatar(author: string): { initial: string; color: string } {
  const clean = author.trim()
  const initial = clean.length > 0 ? (clean[0]?.toUpperCase() ?? '?') : '?'

  let hash = 0
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i)
    hash |= 0
  }

  const index = Math.abs(hash) % AVATAR_PALETTE.length
  const color = AVATAR_PALETTE[index] ?? '#388bfd'

  return { initial, color }
}

/**
 * Format date string into YYYY-MM-DD HH:mm:ss.
 * @param dateStr - ISO or Git date string.
 * @returns Clean formatted local date and time string.
 */
export function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr

  const pad = (n: number) => String(n).padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
