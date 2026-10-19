/**
 * Core type declarations for the experimental Git plugin.
 * Shared across the Host RPC handlers and Client UI viewers.
 */

/** File change status representation in git */
export type GitFileStatusCode = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'copied'

/** One changed file entry in the working directory or staging area */
export interface GitFileStatus {
  /** Relative file path from the repository root */
  readonly path: string
  /** Previous path if the file was renamed */
  readonly originalPath?: string
  /** Normalized status kind */
  readonly status: GitFileStatusCode
  /** Whether the change has been staged to index */
  readonly staged: boolean
}

/** Information about one local git branch */
export interface GitBranchInfo {
  /** Branch name (e.g. 'main', 'master', 'feature/xyz') */
  readonly name: string
  /** Whether this branch is currently checked out */
  readonly isCurrent: boolean
  /** Upstream tracking branch if configured */
  readonly upstream?: string
  /** Number of commits ahead of upstream */
  readonly ahead?: number
  /** Number of commits behind upstream */
  readonly behind?: number
}

/** Full status summary of the workspace repository */
export interface GitStatusSummary {
  /** Whether the checked directory is inside a Git worktree/repository */
  readonly isRepo: boolean
  /** Absolute root directory of the repository */
  readonly rootPath?: string
  /** Current branch name, or commit hash if detached */
  readonly branch?: string
  /** Upstream branch name */
  readonly upstream?: string
  /** Commits ahead of upstream */
  readonly ahead: number
  /** Commits behind upstream */
  readonly behind: number
  /** Latest commit summary on current HEAD */
  readonly headCommit?: {
    readonly hash: string
    readonly shortHash: string
    readonly message: string
  }
  /** Staged changes in index */
  readonly staged: readonly GitFileStatus[]
  /** Unstaged changes in working tree */
  readonly unstaged: readonly GitFileStatus[]
  /** Untracked new files */
  readonly untracked: readonly GitFileStatus[]
  /** Total count of all changed/untracked files */
  readonly totalChanges: number
}

/** One commit log entry */
export interface GitCommitItem {
  /** Full 40-character commit hash */
  readonly hash: string
  /** Abbreviated 7-character commit hash */
  readonly shortHash: string
  /** Author name */
  readonly author: string
  /** Author email address */
  readonly authorEmail: string
  /** Human-readable relative date (e.g. '2 hours ago') */
  readonly relativeDate: string
  /** ISO date string */
  readonly date: string
  /** Commit subject/first line of commit message */
  readonly subject: string
}

/** One file's diff result */
export interface GitDiffFile {
  /** File path */
  readonly path: string
  /** Old file path if renamed */
  readonly oldPath?: string
  /** Change status */
  readonly status: GitFileStatusCode
  /** Raw unified diff patch lines */
  readonly diffText: string
  /** Count of added lines */
  readonly additions: number
  /** Count of removed lines */
  readonly deletions: number
}

/** Complete diff result summary */
export interface GitDiffSummary {
  /** List of parsed diff files */
  readonly files: readonly GitDiffFile[]
  /** Complete raw unified diff output */
  readonly rawDiff: string
}
