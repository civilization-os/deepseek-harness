/**
 * Browser entry for the experimental Git right-sidebar plugin.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {
  GitCommitItem,
  GitDiffSummary,
  GitStatusSummary,
} from '../types.ts'
import { GIT_ID, gitDefinition } from './definition.tsx'
import { GitBody, type GitInjected } from './GitBody.tsx'
import { GitTitle } from './GitTitle.tsx'
import { en, NS, zh } from './locales.ts'
import type {} from './locales.ts'

export type { GitBodyProps, GitInjected } from './GitBody.tsx'
export type { GitViewKey } from './locales.ts'

/**
 * Required browser services.
 */
export const inject = ['connection', 'slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

/**
 * Client plugin body: registers Git tab definition, locales, shortcut, and components.
 * @param ctx - Client context carrying slots and connection services.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)

  // Register localization dictionaries
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'experimental-git: locales')

  // Register tab definition
  ctx.effect(() => ctx.sidebarRightTabs.register(gitDefinition(t)), 'experimental-git: tab definition')

  // Register shortcut command
  ctx.inject(['shortcuts'], (scope) => {
    scope.effect(() => scope.shortcuts.register({
      id: 'workspace.git' as ShortcutCommandId,
      label: () => t('guide.title'),
      aliases: ['workspace git', 'git', 'source control'],
      defaults: {
        'desktop:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
        'desktop:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
        'desktop:linux': { code: 'KeyG', modifiers: ['primary', 'shift'] },
        'web:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
        'web:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
      },
      regions: ['page', 'editable', 'terminal'],
      modals: [],
      resolve: ({ target: element }) => {
        const target = scope.sidebarRight.commandTarget(element)
        if (target === undefined) return { status: 'blocked', reason: t('shortcut.noSession') }
        return { status: 'handled', run: () => { scope.sidebarRight.openTabFromTarget('git', target) } }
      },
    }), 'experimental-git: shortcut')
  })

  // Define RPC actions bound to Connection
  const getConnection = (): ConnectionHandle => {
    const handle = ctx.get('connection') as ConnectionHandle | undefined
    if (!handle) throw new Error('Connection service not available')
    return handle
  }

  const actions: GitInjected = {
    getStatus: async (sessionId) => {
      const conn = getConnection()
      const res = await conn.rpc.call('/git', 'status', { sessionId })
      if (!res.ok) throw new Error(res.error.message)
      return res.value as GitStatusSummary
    },
    getLog: async (sessionId, maxCount) => {
      const conn = getConnection()
      const res = await conn.rpc.call('/git', 'log', { sessionId, maxCount })
      if (!res.ok) throw new Error(res.error.message)
      return res.value as readonly GitCommitItem[]
    },
    getDiff: async (sessionId, options) => {
      const conn = getConnection()
      const res = await conn.rpc.call('/git', 'diff', { sessionId, ...options })
      if (!res.ok) throw new Error(res.error.message)
      return res.value as GitDiffSummary
    },
  }

  // Register slot implementations
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    {
      name: 'sidebar.right.pane.tab',
      key: GIT_ID,
      locale: NS,
      inject: () => actions,
    },
    GitBody,
  )), 'experimental-git: tab body')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    {
      name: 'sidebar.right.pane.tab.title',
      key: GIT_ID,
    },
    GitTitle,
  )), 'experimental-git: tab title')
}
