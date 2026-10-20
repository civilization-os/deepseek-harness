import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  GitBranchInfo,
  GitBranchesSummary,
  GitCommitDetail,
  GitCommitItem,
  GitDiffFile,
  GitDiffSummary,
  GitFileStatus,
  GitFileStatusCode,
  GitGraphLanePath,
  GitOperationResult,
  GitStatusSummary,
} from './types.ts'

const execFileAsync = promisify(execFile)

/** Timeout in milliseconds for git operations */
const GIT_TIMEOUT_MS = 15_000
/** Maximum stdout buffer for git diff / log output (8MB) */
const GIT_MAX_BUFFER = 8 * 1024 * 1024

/** Vibrant IDEA-grade color palette for DAG branches */
const LANE_PALETTE: readonly string[] = [
  '#388bfd', // Blue
  '#2ea043', // Green
  '#f0883e', // Orange
  '#a371f7', // Purple
  '#db61a2', // Rose
  '#39c5bb', // Cyan
  '#f9c513', // Amber
]

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
 * Detailed execution result returning stdout, stderr, and success code.
 * @param cwd - Working directory.
 * @param args - Arguments.
 * @returns Standard execution details.
 */
export async function runGitDetailed(cwd: string, args: readonly string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args as string[], {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
      encoding: 'utf8',
    })
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      stdout: (error.stdout ?? '').trim(),
      stderr: (error.stderr || error.message || String(err)).trim(),
    }
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
 * Parse refs from git %D format (e.g. "HEAD -> master, origin/master, tag: v0.1").
 * @param refStr - Raw refs string.
 * @returns Normalized list of clean ref names.
 */
function parseCommitRefs(refStr: string): string[] {
  if (!refStr.trim()) return []
  const parts = refStr.split(',')
  const refs: string[] = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('HEAD -> ')) {
      refs.push(trimmed.slice(8))
    } else {
      refs.push(trimmed)
    }
  }
  return refs
}

/**
 * Compute DAG topology lanes and vector paths for commits (IntelliJ IDEA style graph).
 * @param rawCommits - Chronological descending commits with parents.
 * @returns Commits augmented with lane indices, lane colors, and connecting paths.
 */
function buildDagTopology(rawCommits: {
  hash: string
  shortHash: string
  author: string
  authorEmail: string
  relativeDate: string
  date: string
  subject: string
  parents: string[]
  refs: string[]
}[]): GitCommitItem[] {
  const activeLanes: (string | null)[] = []
  const result: GitCommitItem[] = []

  for (const item of rawCommits) {
    // 1. Locate current commit lane
    let lane = activeLanes.indexOf(item.hash)
    if (lane === -1) {
      // Find first empty slot or append
      const emptySlot = activeLanes.indexOf(null)
      if (emptySlot !== -1) {
        lane = emptySlot
      } else {
        lane = activeLanes.length
        activeLanes.push(null)
      }
    }

    const laneColor = LANE_PALETTE[lane % LANE_PALETTE.length] ?? '#388bfd'
    // Clear current position
    activeLanes[lane] = null

    // 2. Map parents to target lanes
    const paths: GitGraphLanePath[] = []
    const [firstParent, ...otherParents] = item.parents

    if (firstParent) {
      // First parent continues on this lane, or merges if already tracked elsewhere
      const existingParentLane = activeLanes.indexOf(firstParent)
      if (existingParentLane !== -1) {
        paths.push({
          fromLane: lane,
          toLane: existingParentLane,
          kind: 'merge',
          color: laneColor,
        })
      } else {
        activeLanes[lane] = firstParent
        paths.push({
          fromLane: lane,
          toLane: lane,
          kind: 'straight',
          color: laneColor,
        })
      }
    }

    // Additional parents (merge commit)
    for (const otherParent of otherParents) {
      const existingLane = activeLanes.indexOf(otherParent)
      if (existingLane !== -1) {
        paths.push({
          fromLane: lane,
          toLane: existingLane,
          kind: 'merge',
          color: LANE_PALETTE[existingLane % LANE_PALETTE.length] ?? laneColor,
        })
      } else {
        // Allocate a new lane for this merged-in branch
        const emptySlot = activeLanes.indexOf(null)
        const newLane = emptySlot !== -1 ? emptySlot : activeLanes.length
        if (emptySlot !== -1) activeLanes[emptySlot] = otherParent
        else activeLanes.push(otherParent)

        const branchColor = LANE_PALETTE[newLane % LANE_PALETTE.length] ?? laneColor
        paths.push({
          fromLane: lane,
          toLane: newLane,
          kind: 'fork',
          color: branchColor,
        })
      }
    }

    // Add pass-through straight lines for other active lanes
    for (let l = 0; l < activeLanes.length; l++) {
      if (l !== lane && activeLanes[l] !== null) {
        paths.push({
          fromLane: l,
          toLane: l,
          kind: 'straight',
          color: LANE_PALETTE[l % LANE_PALETTE.length] ?? '#388bfd',
        })
      }
    }

    // Trim trailing empty lanes
    while (activeLanes.length > 0 && activeLanes.at(-1) === null) {
      activeLanes.pop()
    }

    result.push({
      hash: item.hash,
      shortHash: item.shortHash,
      author: item.author,
      authorEmail: item.authorEmail,
      relativeDate: item.relativeDate,
      date: item.date,
      subject: item.subject,
      parents: item.parents,
      refs: item.refs,
      lane,
      laneColor,
      paths,
    })
  }

  return result
}

/**
 * Query recent git commit history with DAG graph topology for the given directory.
 * @param cwd - Target directory.
 * @param maxCount - Maximum number of commits to retrieve (defaults to 50).
 * @returns Ordered list of recent commits with topology paths.
 */
export async function getGitLog(cwd: string, maxCount = 50): Promise<readonly GitCommitItem[]> {
  const isRepo = await checkIsGitRepo(cwd)
  if (!isRepo) return []

  const raw = await runGit(cwd, [
    'log',
    '-n',
    String(maxCount),
    '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ar%x1f%ad%x1f%s%x1f%P%x1f%D',
  ])
  if (!raw) return []

  const rawCommits: {
    hash: string
    shortHash: string
    author: string
    authorEmail: string
    relativeDate: string
    date: string
    subject: string
    parents: string[]
    refs: string[]
  }[] = []

  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    if (!line) continue
    const parts = line.split('\x1f')
    if (parts.length >= 7 && parts[0] && parts[1] && parts[2] && parts[3] && parts[4] && parts[5] && parts[6] !== undefined) {
      const parentStr = parts[7] ?? ''
      const parents = parentStr.trim() ? parentStr.trim().split(/\s+/) : []
      const refStr = parts[8] ?? ''
      const refs = parseCommitRefs(refStr)

      rawCommits.push({
        hash: parts[0],
        shortHash: parts[1],
        author: parts[2],
        authorEmail: parts[3],
        relativeDate: parts[4],
        date: parts[5],
        subject: parts[6],
        parents,
        refs,
      })
    }
  }

  return buildDagTopology(rawCommits)
}

/**
 * Query details and changed files for a specific commit.
 * @param cwd - Working directory.
 * @param commitHash - Full or abbreviated commit hash.
 * @returns Detailed commit information.
 */
export async function getGitCommitDetails(cwd: string, commitHash: string): Promise<GitCommitDetail | undefined> {
  const isRepo = await checkIsGitRepo(cwd)
  if (!isRepo) return undefined

  // 1. Get commit header metadata
  const headRaw = await runGit(cwd, [
    'show',
    '--no-patch',
    '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ar%x1f%ad%x1f%s%x1f%P%x1f%D',
    commitHash,
  ])
  if (!headRaw) return undefined

  const parts = headRaw.split('\x1f')
  if (parts.length < 7 || !parts[0] || !parts[1] || !parts[2] || !parts[3] || !parts[4] || !parts[5] || parts[6] === undefined) {
    return undefined
  }

  const parentStr = parts[7] ?? ''
  const parents = parentStr.trim() ? parentStr.trim().split(/\s+/) : []
  const refStr = parts[8] ?? ''
  const refs = parseCommitRefs(refStr)

  const commit: GitCommitItem = {
    hash: parts[0],
    shortHash: parts[1],
    author: parts[2],
    authorEmail: parts[3],
    relativeDate: parts[4],
    date: parts[5],
    subject: parts[6],
    parents,
    refs,
  }

  // 2. Get changed files with numstat
  const numstatRaw = await runGit(cwd, [
    'show',
    '--numstat',
    '--format=',
    '-M',
    commitHash,
  ])

  const files: {
    path: string
    oldPath?: string
    status: GitFileStatusCode
    additions: number
    deletions: number
  }[] = []

  let totalAdditions = 0
  let totalDeletions = 0

  if (numstatRaw) {
    const lines = numstatRaw.split(/\r?\n/)
    for (const line of lines) {
      if (!line.trim()) continue
      const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line)
      if (match && match[1] && match[2] && match[3]) {
        const adds = match[1] === '-' ? 0 : Number.parseInt(match[1], 10)
        const dels = match[2] === '-' ? 0 : Number.parseInt(match[2], 10)
        const rawPath = match[3]

        let path = rawPath
        let oldPath: string | undefined
        let status: GitFileStatusCode = 'modified'

        if (rawPath.includes(' => ')) {
          status = 'renamed'
          // Formats like "src/{old.ts => new.ts}" or "old.ts => new.ts"
          const braceMatch = /^(.*)\{(.+) => (.+)\}(.*)$/.exec(rawPath)
          const hasBraceGroups = braceMatch && braceMatch[1] !== undefined
            && braceMatch[2] !== undefined && braceMatch[3] !== undefined && braceMatch[4] !== undefined
          if (hasBraceGroups) {
            oldPath = `${braceMatch[1]}${braceMatch[2]}${braceMatch[4]}`
            path = `${braceMatch[1]}${braceMatch[3]}${braceMatch[4]}`
          } else {
            const split = rawPath.split(' => ')
            oldPath = split[0]?.trim()
            path = split[1]?.trim() ?? rawPath
          }
        }

        totalAdditions += adds
        totalDeletions += dels

        files.push({
          path,
          ...oldPath !== undefined ? { oldPath } : {},
          status,
          additions: adds,
          deletions: dels,
        })
      }
    }
  }

  return { commit, files, totalAdditions, totalDeletions }
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
 * Query local and remote branches.
 * @param cwd - Target directory.
 * @returns Aggregated branch summary.
 */
export async function getGitAllBranches(cwd: string): Promise<GitBranchesSummary> {
  const isRepo = await checkIsGitRepo(cwd)
  if (!isRepo) return { local: [], remote: [] }

  const raw = await runGit(cwd, ['branch', '-a', '-vv', '--list'])
  if (!raw) return { local: [], remote: [] }

  const local: GitBranchInfo[] = []
  const remote: GitBranchInfo[] = []
  let current: string | undefined

  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const isCurrent = line.startsWith('*')
    const cleanLine = line.slice(2).trim()

    // Skip detached HEAD or symbolic pointers like remotes/origin/HEAD -> origin/master
    if (cleanLine.includes('->')) continue

    const spaceIndex = cleanLine.indexOf(' ')
    const fullName = spaceIndex !== -1 ? cleanLine.slice(0, spaceIndex) : cleanLine

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

    if (isCurrent) {
      current = fullName
    }

    if (fullName.startsWith('remotes/')) {
      const remoteName = fullName.replace(/^remotes\//, '')
      remote.push({
        name: remoteName,
        isCurrent: false,
      })
    } else {
      local.push({
        name: fullName,
        isCurrent,
        ...upstream !== undefined ? { upstream } : {},
        ...ahead !== undefined ? { ahead } : {},
        ...behind !== undefined ? { behind } : {},
      })
    }
  }

  return {
    ...current !== undefined ? { current } : {},
    local,
    remote,
  }
}


/**
 * Query git local branches (legacy helper).
 * @param cwd - Target directory.
 * @returns List of branch information.
 */
export async function getGitBranches(cwd: string): Promise<readonly GitBranchInfo[]> {
  const summary = await getGitAllBranches(cwd)
  return summary.local
}

/**
 * Checkout an existing branch or create a new branch.
 * @param cwd - Target directory.
 * @param branch - Branch name to switch to.
 * @param createNew - Whether to create a new branch (-b).
 * @returns Operation result.
 */
export async function gitCheckout(cwd: string, branch: string, createNew?: boolean): Promise<GitOperationResult> {
  const cleanBranch = branch.trim()
  if (!cleanBranch) return { success: false, message: 'Branch name cannot be empty' }

  const args = createNew ? ['checkout', '-b', cleanBranch] : ['checkout', cleanBranch]
  const res = await runGitDetailed(cwd, args)
  return {
    success: res.ok,
    message: res.ok ? `Checked out branch ${cleanBranch}` : res.stderr || 'Checkout failed',
    output: res.stdout || res.stderr,
  }
}

/**
 * Stage files to index.
 * @param cwd - Target directory.
 * @param paths - Specific file paths or 'all'.
 * @returns Operation result.
 */
export async function gitStage(cwd: string, paths: readonly string[] | 'all'): Promise<GitOperationResult> {
  const args = paths === 'all' ? ['add', '-A'] : ['add', '--', ...paths]
  const res = await runGitDetailed(cwd, args)
  return {
    success: res.ok,
    message: res.ok ? 'Files staged successfully' : res.stderr || 'Stage failed',
    output: res.stdout || res.stderr,
  }
}

/**
 * Unstage files from index.
 * @param cwd - Target directory.
 * @param paths - Specific file paths or 'all'.
 * @returns Operation result.
 */
export async function gitUnstage(cwd: string, paths: readonly string[] | 'all'): Promise<GitOperationResult> {
  const args = paths === 'all' ? ['reset', 'HEAD'] : ['reset', 'HEAD', '--', ...paths]
  const res = await runGitDetailed(cwd, args)
  return {
    success: res.ok,
    message: res.ok ? 'Files unstaged successfully' : res.stderr || 'Unstage failed',
    output: res.stdout || res.stderr,
  }
}

/**
 * Discard working tree changes for specified files.
 * @param cwd - Target directory.
 * @param paths - Specific file paths to discard.
 * @returns Operation result.
 */
export async function gitDiscard(cwd: string, paths: readonly string[]): Promise<GitOperationResult> {
  if (paths.length === 0) return { success: true }
  // 1. Restore tracked changes
  const resRestore = await runGitDetailed(cwd, ['checkout', '--', ...paths])
  // 2. Clean untracked files if any
  await runGitDetailed(cwd, ['clean', '-f', '--', ...paths])
  return {
    success: resRestore.ok,
    message: resRestore.ok ? 'Changes discarded successfully' : resRestore.stderr || 'Discard failed',
    output: resRestore.stdout || resRestore.stderr,
  }
}

/**
 * Commit staged changes with message.
 * @param cwd - Target directory.
 * @param message - Commit message.
 * @returns Operation result.
 */
export async function gitCommit(cwd: string, message: string): Promise<GitOperationResult> {
  const trimmed = message.trim()
  if (!trimmed) return { success: false, message: 'Commit message cannot be empty' }
  const res = await runGitDetailed(cwd, ['commit', '-m', trimmed])
  return {
    success: res.ok,
    message: res.ok ? 'Changes committed successfully' : res.stderr || 'Commit failed',
    output: res.stdout || res.stderr,
  }
}

/**
 * Fetch updates from remotes.
 * @param cwd - Target directory.
 * @returns Operation result.
 */
export async function gitFetch(cwd: string): Promise<GitOperationResult> {
  const res = await runGitDetailed(cwd, ['fetch', '--all', '--prune'])
  return {
    success: res.ok,
    message: res.ok ? 'Fetched successfully' : res.stderr || 'Fetch failed',
    output: res.stdout || res.stderr,
  }
}

/**
 * Pull remote changes into current branch.
 * @param cwd - Target directory.
 * @returns Operation result.
 */
export async function gitPull(cwd: string): Promise<GitOperationResult> {
  const res = await runGitDetailed(cwd, ['pull'])
  return {
    success: res.ok,
    message: res.ok ? 'Pulled successfully' : res.stderr || 'Pull failed',
    output: res.stdout || res.stderr,
  }
}

/**
 * Push local commits to remote upstream.
 * @param cwd - Target directory.
 * @returns Operation result.
 */
export async function gitPush(cwd: string): Promise<GitOperationResult> {
  const res = await runGitDetailed(cwd, ['push'])
  return {
    success: res.ok,
    message: res.ok ? 'Pushed successfully' : res.stderr || 'Push failed',
    output: res.stdout || res.stderr,
  }
}
