import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  checkIsGitRepo,
  getGitBranches,
  getGitDiff,
  getGitLog,
  getGitStatus,
} from '../src/git-executor.ts'
import * as GitPlugin from '../src/index.ts'

const exec = promisify(execFile)
let testDir: string | undefined

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true })
    testDir = undefined
  }
})

describe('git-executor', () => {
  it('correctly inspects repo status, commits, branches, and diffs', async () => {
    testDir = await realpath(await mkdtemp(join(tmpdir(), 'dsh-git-test-')))
    const repo = join(testDir, 'repo')
    await mkdir(repo)

    const git = (...args: string[]) => exec('git', args, {
      cwd: repo,
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '',
        GIT_AUTHOR_NAME: 'Test Author',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test Author',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    })

    // Before init
    expect(await checkIsGitRepo(repo)).toBe(false)
    const emptyStatus = await getGitStatus(repo)
    expect(emptyStatus.isRepo).toBe(false)

    // Init repo
    await git('init', '-b', 'main')
    await git('config', 'user.name', 'Test Author')
    await git('config', 'user.email', 'test@example.com')
    expect(await checkIsGitRepo(repo)).toBe(true)

    // Initial commit
    await writeFile(join(repo, 'hello.txt'), 'hello world\n')
    await git('add', 'hello.txt')
    await git('commit', '-m', 'feat: initial commit')

    // Clean status
    let status = await getGitStatus(repo)
    expect(status.isRepo).toBe(true)
    expect(status.branch).toBe('main')
    expect(status.totalChanges).toBe(0)
    expect(status.headCommit?.message).toBe('feat: initial commit')

    // Add modified and untracked files
    await writeFile(join(repo, 'hello.txt'), 'hello world modified\n')
    await writeFile(join(repo, 'new-file.ts'), 'export const x = 1\n')

    status = await getGitStatus(repo)
    expect(status.totalChanges).toBe(2)
    expect(status.unstaged.some(f => f.path === 'hello.txt' && f.status === 'modified')).toBe(true)
    expect(status.untracked.some(f => f.path === 'new-file.ts' && f.status === 'untracked')).toBe(true)

    // Diff
    const diff = await getGitDiff(repo, { path: 'hello.txt' })
    expect(diff.rawDiff).toContain('+hello world modified')
    expect(diff.rawDiff).toContain('-hello world')

    // Log
    const logs = await getGitLog(repo)
    expect(logs.length).toBe(1)
    expect(logs[0]?.subject).toBe('feat: initial commit')
    expect(logs[0]?.author).toBe('Test Author')

    // Branches
    const branches = await getGitBranches(repo)
    expect(branches.some(b => b.name === 'main' && b.isCurrent)).toBe(true)
  })
})

describe('git host plugin', () => {
  it('registers connection RPC interceptor and responds to git queries', async () => {
    testDir = await realpath(await mkdtemp(join(tmpdir(), 'dsh-git-plugin-test-')))
    const repo = join(testDir, 'repo')
    await mkdir(repo)

    const git = (...args: string[]) => exec('git', args, { cwd: repo })
    await git('init', '-b', 'master')
    await git('config', 'user.name', 'Plugin Tester')
    await git('config', 'user.email', 'tester@example.com')
    await writeFile(join(repo, 'readme.md'), '# Test\n')
    await git('add', 'readme.md')
    await git('commit', '-m', 'docs: init readme')

    const ctx = new Context()
    let rpcHandler: ((endpoint: string, payload: unknown, signal: AbortSignal, peer: unknown) => Promise<unknown>) | undefined

    // Mock connection service
    ctx.provide('connection')
    ctx.connection = {
      rpc: {
        handle: (channel: string, handler: typeof rpcHandler) => {
          expect(channel).toBe('/git')
          rpcHandler = handler
          return async () => {}
        },
      },
    } as never

    // Mock sandbox policy
    ctx.provide('sandboxPolicy')
    ctx.sandboxPolicy = { workspaceRoot: repo } as never

    GitPlugin.apply(ctx)
    expect(rpcHandler).toBeDefined()

    // Test RPC status
    const statusResult = (await rpcHandler!('status', {}, new AbortController().signal, {})) as { ok: boolean; value: { isRepo: boolean; branch: string } }
    expect(statusResult.ok).toBe(true)
    expect(statusResult.value.isRepo).toBe(true)
    expect(statusResult.value.branch).toBe('master')

    // Test RPC log
    const logResult = (await rpcHandler!('log', { maxCount: 5 }, new AbortController().signal, {})) as { ok: boolean; value: Array<{ subject: string }> }
    expect(logResult.ok).toBe(true)
    expect(logResult.value.length).toBe(1)
    expect(logResult.value[0]?.subject).toBe('docs: init readme')

    await ctx.fiber.dispose()
  })
})
