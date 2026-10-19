/**
 * Agent model tool for inspecting Git repository status, commits, and diffs.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { getGitBranches, getGitDiff, getGitLog, getGitStatus } from './git-executor.ts'

/**
 * Register the git_view tool in the tools service.
 * @param ctx - Context carrying the tools service.
 * @param resolveDir - Resolver for the current agent or session working directory.
 */
export function registerGitTool(ctx: Context, resolveDir: (sessionId?: string) => string): void {
  ctx.inject(['tools'], (scope) => {
    scope.effect(() => scope.tools.register(defineTool({
      name: 'git_view',
      description: 'Inspect the current project Git repository status, changed files, commit history, branch list, or code diffs.',
      parameters: {
        action: {
          type: 'string',
          enum: ['status', 'log', 'diff', 'branches'],
          description: 'The Git query action to perform: "status" (default, file changes and branch info), "log" (recent commits), "diff" (code changes), or "branches" (branch list).',
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
          description: 'Maximum number of commits to retrieve when action is "log" (defaults to 20).',
        },
        commit: {
          type: 'string',
          description: 'Specific commit hash to inspect diff for.',
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
        const cwd = resolveDir(exec.agent?.session?.id)
        const action = args.action ?? 'status'

        switch (action) {
          case 'log': {
            const rawCommits = await getGitLog(cwd, args.maxCount ?? 20)
            const commits = rawCommits.map(c => ({
              hash: c.hash,
              shortHash: c.shortHash,
              author: c.author,
              authorEmail: c.authorEmail,
              relativeDate: c.relativeDate,
              date: c.date,
              subject: c.subject,
            }))
            return { action: 'log', count: commits.length, commits }
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
            const rawBranches = await getGitBranches(cwd)
            const branches = rawBranches.map(b => ({
              name: b.name,
              isCurrent: b.isCurrent,
              ...b.upstream !== undefined ? { upstream: b.upstream } : {},
              ...b.ahead !== undefined ? { ahead: b.ahead } : {},
              ...b.behind !== undefined ? { behind: b.behind } : {},
            }))
            return { action: 'branches', branches }
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
  })
}
