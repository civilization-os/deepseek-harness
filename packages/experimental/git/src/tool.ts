/**
 * Agent model tool for inspecting Git repository status, commits, and diffs.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  getGitAllBranches,
  getGitCommitDetails,
  getGitDiff,
  getGitLog,
  getGitStatus,
  gitCheckout,
} from './git-executor.ts'

/**
 * Register git model tools (git_view and git_checkout) in the tools service.
 * @param ctx - Context carrying the tools service.
 * @param resolveDir - Resolver for the current agent or session working directory.
 */
export function registerGitTool(ctx: Context, resolveDir: (sessionId?: string) => string): void {
  ctx.inject(['tools'], (scope) => {
    // 1. Tool for inspecting git status, DAG history, diff, and branches
    scope.effect(() => scope.tools.register(defineTool({
      name: 'git_view',
      description: 'Inspect the current project Git repository status, changed files, DAG commit tree, branch list, or code diffs.',
      parameters: {
        action: {
          type: 'string',
          enum: ['status', 'log', 'diff', 'branches', 'commit'],
          description: 'The Git query action to perform: "status" (default, file changes and branch info), "log" (recent commits with DAG topology rails), "diff" (code changes), "branches" (local and remote branches), or "commit" (details for a specific commit).',
        },
        path: {
          type: 'string',
          description: 'Optional file path filter for diff or status inspection.',
        },
        staged: {
          type: 'boolean',
          description: 'Whether to check staged changes when viewing diff (defaults to false for working tree changes).',
        },
        maxCount: {
          type: 'number',
          description: 'Maximum number of commits to retrieve when action is "log" (defaults to 30).',
        },
        commit: {
          type: 'string',
          description: 'Specific commit hash to inspect diff or details for.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(args, exec): Promise<Record<string, JsonValue>> {
        const cwd = resolveDir(exec.agent?.session.id)
        const action = args.action ?? 'status'

        switch (action) {
          case 'log': {
            const rawCommits = await getGitLog(cwd, args.maxCount ?? 30)
            const commits = rawCommits.map(c => ({
              hash: c.hash,
              shortHash: c.shortHash,
              author: c.author,
              authorEmail: c.authorEmail,
              relativeDate: c.relativeDate,
              date: c.date,
              subject: c.subject,
              parents: c.parents ? [...c.parents] : [],
              refs: c.refs ? [...c.refs] : [],
              ...c.lane !== undefined ? { lane: c.lane } : {},
              ...c.laneColor !== undefined ? { laneColor: c.laneColor } : {},
            }))
            return { action: 'log', count: commits.length, commits }
          }
          case 'commit': {
            if (!args.commit) {
              return { action: 'commit', error: 'Missing commit parameter' }
            }
            const details = await getGitCommitDetails(cwd, args.commit)
            if (!details) return { action: 'commit', found: false }
            return {
              action: 'commit',
              found: true,
              commit: {
                hash: details.commit.hash,
                shortHash: details.commit.shortHash,
                author: details.commit.author,
                date: details.commit.date,
                subject: details.commit.subject,
              },
              files: details.files.map(f => ({
                path: f.path,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
              })),
              totalAdditions: details.totalAdditions,
              totalDeletions: details.totalDeletions,
            }
          }
          case 'diff': {
            const diff = await getGitDiff(cwd, {
              ...args.path !== undefined ? { path: args.path } : {},
              ...args.staged !== undefined ? { staged: args.staged } : {},
              ...args.commit !== undefined ? { commit: args.commit } : {},
            })
            const files = diff.files.map(f => ({ path: f.path, additions: f.additions, deletions: f.deletions }))
            return { action: 'diff', files, rawDiff: diff.rawDiff }
          }
          case 'branches': {
            const summary = await getGitAllBranches(cwd)
            return {
              action: 'branches',
              ...summary.current !== undefined ? { current: summary.current } : {},
              local: summary.local.map(b => ({
                name: b.name,
                isCurrent: b.isCurrent,
                ...b.upstream !== undefined ? { upstream: b.upstream } : {},
                ...b.ahead !== undefined ? { ahead: b.ahead } : {},
                ...b.behind !== undefined ? { behind: b.behind } : {},
              })),
              remote: summary.remote.map(b => ({
                name: b.name,
                isCurrent: b.isCurrent,
              })),
            }
          }
          case 'status':
          default: {
            const status = await getGitStatus(cwd)
            return {
              action: 'status',
              isRepo: status.isRepo,
              ...status.rootPath !== undefined ? { rootPath: status.rootPath } : {},
              ...status.branch !== undefined ? { branch: status.branch } : {},
              ...status.upstream !== undefined ? { upstream: status.upstream } : {},
              ahead: status.ahead,
              behind: status.behind,
              staged: status.staged.map(f => ({ path: f.path, status: f.status, staged: f.staged })),
              unstaged: status.unstaged.map(f => ({ path: f.path, status: f.status, staged: f.staged })),
              untracked: status.untracked.map(f => ({ path: f.path, status: f.status, staged: f.staged })),
              totalChanges: status.totalChanges,
            }
          }
        }
      },
      presentCall: args => ({ card: 'generic', title: `git_view (${args.action ?? 'status'})`, rawInput: args }),
    })), 'experimental-git: register git_view tool')

    // 2. Dedicated tool for checking out or creating branches
    scope.effect(() => scope.tools.register(defineTool({
      name: 'git_checkout',
      description: 'Switch branch or create and checkout a new branch in the current project Git repository.',
      parameters: {
        branch: {
          type: 'string',
          required: true,
          description: 'The target branch name to switch to (e.g. "feature/auth", "dev", "master").',
        },
        create: {
          type: 'boolean',
          description: 'Whether to create a new branch from current HEAD and check it out (-b). Defaults to false.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        render: (_args, val) => {
          const value = val as { success?: boolean; branch?: string; message?: string }
          return [{
            type: 'text',
            text: value.success
              ? `Successfully checked out branch '${value.branch ?? ''}'.`
              : `Failed to checkout branch '${value.branch ?? ''}': ${value.message ?? ''}`,
          }]
        },
      },

      async execute(args, exec): Promise<Record<string, JsonValue>> {
        const cwd = resolveDir(exec.agent?.session.id)
        const branch = args.branch.trim()
        const createNew = args.create ?? false
        const result = await gitCheckout(cwd, branch, createNew)

        return {
          success: result.success,
          branch,
          message: result.message ?? '',
        }
      },
      presentCall: args => ({
        card: 'generic',
        title: `git_checkout ${args.create ? '-b ' : ''}${args.branch}`,
        rawInput: args,
      }),
    })), 'experimental-git: register git_checkout tool')
  })
}
