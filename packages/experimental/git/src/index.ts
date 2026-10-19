/**
 * Host entry for the experimental Git plugin.
 * Provides RPC endpoints for the Client right-sidebar viewer and the model tool for Agents.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { getGitBranches, getGitDiff, getGitLog, getGitStatus } from './git-executor.ts'
import { registerGitTool } from './tool.ts'

export type * from './types.ts'

/** Cordis plugin name */
export const name = 'experimental-git'

/** Required host services */
export const inject = ['connection']

/**
 * Apply the Git host plugin.
 * Sets up authenticated RPC handlers under `/git/*` and registers the model tool.
 * @param ctx - Context carrying the connection and optional session services.
 */
export function apply(ctx: Context): void {
  const resolveTargetDir = (sessionId?: string): string => {
    if (sessionId) {
      const liveCwd = ctx.get('sessions')?.get(sessionId as SessionId)?.header.cwd
      if (liveCwd) return liveCwd
    }
    const workspaceRoot = ctx.get('sandboxPolicy')?.workspaceRoot
    return workspaceRoot ?? process.cwd()
  }

  // Register dedicated /git RPC channel
  ctx.connection.rpc.handle(
    '/git',
    async (endpoint: string, payload: unknown, _signal: AbortSignal) => {
      const body = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
      const cwd = typeof body.path === 'string' ? body.path : resolveTargetDir(sessionId)

      try {
        if (endpoint === 'status') {
          const status = await getGitStatus(cwd)
          return { ok: true, value: status }
        }

        if (endpoint === 'log') {
          const maxCount = typeof body.maxCount === 'number' ? body.maxCount : 30
          const commits = await getGitLog(cwd, maxCount)
          return { ok: true, value: commits }
        }

        if (endpoint === 'diff') {
          const path = typeof body.filePath === 'string' ? body.filePath : undefined
          const staged = typeof body.staged === 'boolean' ? body.staged : false
          const commit = typeof body.commit === 'string' ? body.commit : undefined
          const diff = await getGitDiff(cwd, {
            ...path !== undefined ? { path } : {},
            staged,
            ...commit !== undefined ? { commit } : {},
          })
          return { ok: true, value: diff }
        }

        if (endpoint === 'branches') {
          const branches = await getGitBranches(cwd)
          return { ok: true, value: branches }
        }

        return {
          ok: false,
          error: {
            code: 'git/not_found',
            message: `Unknown git RPC endpoint: ${endpoint}`,
            details: {},
          },
        }
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'git/error',
            message: error instanceof Error ? error.message : String(error),
            details: {},
          },
        }
      }
    },
  )

  // Register the agent tool
  registerGitTool(ctx, resolveTargetDir)
}
