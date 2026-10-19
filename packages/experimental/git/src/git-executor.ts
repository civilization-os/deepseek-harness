/**
 * Safe, robust git command executor and porcelain output parsers.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  GitBranchInfo,
  GitCommitItem,
  GitDiffFile,
  GitDiffSummary,
  GitFileStatus,
  GitFileStatusCode,
  GitStatusSummary,
} from './types.ts'

const execFileAsync = promisify(execFile)

/** Timeout in milliseconds for git operations */
const GIT_TIMEOUT_MS = 10_000
/** Maximum stdout buffer for git diff / log output (4MB) */
const GIT_MAX_BUFFER = 4 * 1024 * 1024

/**
 * Execute a git command in the target directory safely.
 * @param cwd - Working directory for the git execution.
 * @param args - Subcommand and arguments to pass to git.
 * @returns Raw stdout trimmed, or undefined if the execution failed.
 */
export async function runGit(cwd: string, args: readonly string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', args as string[], {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
      encoding: 'utf8',
    })
    return stdout.trim()
  } catch {
    return undefined
  }
}

/**
 * Check if the target directory is inside a valid git repository worktree.
 * @param cwd - Target directory.
 * @returns Whether cwd is a git repository.
 */
export async function checkIsGitRepo(cwd: string): Promise<boolean> {
  const result = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
  return result === 'true'
}

/**
 * Get the absolute top-level directory of the git repository.
 * @param cwd - Target directory.
 * @returns Top-level directory path, or undefined.
 */
export async function getGitRoot(cwd: string): Promise<string | undefined> {
  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  return root ? root.replaceAll('\\', '/') : undefined
}

/**
 * Map porcelain status character to normalized status code.
 * @param char - Status character from git porcelain.
 * @returns Normalized status code.
 */
function parseStatusCode(char: string): GitFileStatusCode {
  switch (char) {
    case 'A': return 'added'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    case 'C': return 'copied'
    case '?': return 'untracked'
    case 'M':
    default:
      return 'modified'
  }
}

/**
 * Parse one porcelain file status line.
 * @param line - Raw line from `git status --porcelain=v1`.
 * @returns Status entries for staged, unstaged, or untracked categories.
 */
function parsePorcelainLine(line: string): { staged?: GitFileStatus; unstaged?: GitFileStatus; untracked?: GitFileStatus } {
  if (line.length < 3) return {}
  const x = line[0] ?? ' '
  const y = line[1] ?? ' '
  const rawPath = line.slice(3).trim()

  // Handle renames: "oldPath -> newPath"
  let path = rawPath
  let originalPath: string | undefined
  if (rawPath.includes(' -> ')) {
    const parts = rawPath.split(' -> ')
    originalPath = parts[0]?.replaceAll('"', '')
    path = parts[1]?.replaceAll('"', '') ?? rawPath
  } else {
    path = rawPath.replaceAll('"', '')
  }

  // Untracked files
  if (x === '?' && y === '?') {
    return {
      untracked: {
        path,
        status: 'untracked',
        staged: false,
      },
    }
  }

  const result: { staged?: GitFileStatus; unstaged?: GitFileStatus } = {}

  // Index (staged) change
  if (x !== ' ' && x !== '?') {
    result.staged = {
      path,
      ...originalPath !== undefined ? { originalPath } : {},
      status: parseStatusCode(x),
      staged: true,
    }
  }

  // Working tree (unstaged) change
  if (y !== ' ' && y !== '?') {
    result.unstaged = {
      path,
      ...originalPath !== undefined ? { originalPath } : {},
      status: parseStatusCode(y),
      staged: false,
    }
  }

  return result
}

/**
 * Query full git repository status for the given directory.
 * @param cwd - Target directory.
 * @returns Complete status summary.
 */
export async function getGitStatus(cwd: string): Promise<GitStatusSummary> {
  const isRepo = await checkIsGitRepo(cwd)
  if (!isRepo) {
    return {
      isRepo: false,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      totalChanges: 0,
    }
  }

  const rootPath = await getGitRoot(cwd)
  const porcelain = await runGit(cwd, ['status', '--porcelain=v1', '-b'])

  let branch = 'HEAD'
  let upstream: string | undefined
  let ahead = 0
  let behind = 0

  const staged: GitFileStatus[] = []
  const unstaged: GitFileStatus[] = []
  const untracked: GitFileStatus[] = []

  if (porcelain) {
    const lines = porcelain.split(/\r?\n/)
    for (const line of lines) {
      if (!line) continue

      if (line.startsWith('## ')) {
        // Parse branch line: "## master...origin/master [ahead 1, behind 2]"
        const branchHeader = line.slice(3).trim()
        const bracketIndex = branchHeader.indexOf(' [')
        const branchPart = bracketIndex !== -1 ? branchHeader.slice(0, bracketIndex) : branchHeader

        if (branchPart.includes('...')) {
          const [b, u] = branchPart.split('...')
          branch = b ?? 'HEAD'
          upstream = u
        } else {
          branch = branchPart
        }

        if (bracketIndex !== -1) {
          const aheadMatch = /ahead (\d+)/.exec(branchHeader)
          if (aheadMatch?.[1]) ahead = Number.parseInt(aheadMatch[1], 10)
          const behindMatch = /behind (\d+)/.exec(branchHeader)
          if (behindMatch?.[1]) behind = Number.parseInt(behindMatch[1], 10)
        }
      } else {
        const parsed = parsePorcelainLine(line)
        if (parsed.staged) staged.push(parsed.staged)
        if (parsed.unstaged) unstaged.push(parsed.unstaged)
        if (parsed.untracked) untracked.push(parsed.untracked)
      }
    }
  }

  // Fetch head commit info
  let headCommit: GitStatusSummary['headCommit']
  const headRaw = await runGit(cwd, ['log', '-1', '--pretty=format:%H%x1f%h%x1f%s'])
  if (headRaw) {
    const [hash, shortHash, message] = headRaw.split('\x1f')
    if (hash && shortHash && message !== undefined) {
      headCommit = { hash, shortHash, message }
    }
  }

  return {
    isRepo: true,
    ...rootPath !== undefined ? { rootPath } : {},
    branch,
    ...upstream !== undefined ? { upstream } : {},
    ahead,
    behind,
    ...headCommit !== undefined ? { headCommit } : {},
    staged,
    unstaged,
    untracked,
    totalChanges: staged.length + unstaged.length + untracked.length,
  }
}

/**
 * Query recent git commit history for the given directory.
 * @param cwd - Target directory.
 * @param maxCount - Maximum number of commits to retrieve (defaults to 30).
 * @returns Ordered list of recent commits.
 */
export async function getGitLog(cwd: string, maxCount = 30): Promise<readonly GitCommitItem[]> {
  const isRepo = await checkIsGitRepo(cwd)
  if (!isRepo) return []

  const raw = await runGit(cwd, [
    'log',
    '-n',
    String(maxCount),
    '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ar%x1f%ad%x1f%s',
  ])
  if (!raw) return []

  const commits: GitCommitItem[] = []
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    if (!line) continue
    const parts = line.split('\x1f')
    if (parts.length >= 7 && parts[0] && parts[1] && parts[2] && parts[3] && parts[4] && parts[5] && parts[6] !== undefined) {
      commits.push({
        hash: parts[0],
        shortHash: parts[1],
        author: parts[2],
        authorEmail: parts[3],
        relativeDate: parts[4],
        date: parts[5],
        subject: parts[6],
      })
    }
  }
  return commits
}

/**
 * Query git diff for specified file or current directory.
 * @param cwd - Target directory.
 * @param options - Diff parameters.
 * @returns Complete diff text and per-file parsed statistics.
 */
export async function getGitDiff(
  cwd: string,
  options?: { path?: string; staged?: boolean; commit?: string },
): Promise<GitDiffSummary> {
  const isRepo = await checkIsGitRepo(cwd)
  if (!isRepo) return { files: [], rawDiff: '' }

  const args: string[] = []

  if (options?.commit) {
    args.push('show', '--format=', '--patch', options.commit)
  } else {
    args.push('diff')
    if (options?.staged) {
      args.push('--staged')
    }
  }

  if (options?.path) {
    args.push('--', options.path)
  }

  const rawDiff = (await runGit(cwd, args)) ?? ''
  if (!rawDiff) return { files: [], rawDiff: '' }

  const files: GitDiffFile[] = []
  const fileChunks = rawDiff.split(/^diff --git /m)

  for (const chunk of fileChunks) {
    if (!chunk.trim()) continue
    const firstLineEnd = chunk.indexOf('\n')
    const firstLine = firstLineEnd !== -1 ? chunk.slice(0, firstLineEnd).trim() : chunk.trim()
    const match = /a\/(.+?) b\/(.+?)$/.exec(firstLine)
    const filePath = match?.[2] ?? match?.[1] ?? 'unknown'
    const oldPath = match?.[1] !== match?.[2] ? match?.[1] : undefined

    let additions = 0
    let deletions = 0
    const lines = chunk.split('\n')
    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) additions++
      else if (l.startsWith('-') && !l.startsWith('---')) deletions++
    }

    files.push({
      path: filePath,
      ...oldPath !== undefined ? { oldPath } : {},
      status: 'modified',
      diffText: `diff --git ${chunk}`,
      additions,
      deletions,
    })
  }

  return { files, rawDiff }
}

/**
 * Query git local branches.
 * @param cwd - Target directory.
 * @returns List of branch information.
 */
export async function getGitBranches(cwd: string): Promise<readonly GitBranchInfo[]> {
  const isRepo = await checkIsGitRepo(cwd)
  if (!isRepo) return []

  const raw = await runGit(cwd, ['branch', '-vv', '--list'])
  if (!raw) return []

  const branches: GitBranchInfo[] = []
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    if (!line) continue
    const isCurrent = line.startsWith('*')
    const cleanLine = line.slice(2).trim()
    const spaceIndex = cleanLine.indexOf(' ')
    const name = spaceIndex !== -1 ? cleanLine.slice(0, spaceIndex) : cleanLine

    let upstream: string | undefined
    let ahead: number | undefined
    let behind: number | undefined

    const bracketStart = cleanLine.indexOf('[')
    const bracketEnd = cleanLine.indexOf(']')
    if (bracketStart !== -1 && bracketEnd > bracketStart) {
      const info = cleanLine.slice(bracketStart + 1, bracketEnd)
      const colonIndex = info.indexOf(':')
      upstream = colonIndex !== -1 ? info.slice(0, colonIndex).trim() : info.trim()

      const aheadMatch = /ahead (\d+)/.exec(info)
      if (aheadMatch?.[1]) ahead = Number.parseInt(aheadMatch[1], 10)
      const behindMatch = /behind (\d+)/.exec(info)
      if (behindMatch?.[1]) behind = Number.parseInt(behindMatch[1], 10)
    }

    branches.push({
      name,
      isCurrent,
      ...upstream !== undefined ? { upstream } : {},
      ...ahead !== undefined ? { ahead } : {},
      ...behind !== undefined ? { behind } : {},
    })
  }

  return branches
}
