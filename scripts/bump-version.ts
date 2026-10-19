/**
 * Bump the trailing civilization version in apps/cli/package.json.
 * Usage:
 *   pnpm exec tsx scripts/bump-version.ts          # increments patch: 0.0.1 -> 0.0.2
 *   pnpm exec tsx scripts/bump-version.ts minor    # increments minor: 0.0.1 -> 0.1.0
 *   pnpm exec tsx scripts/bump-version.ts 0.0.5    # sets specific: 0.0.5 -> 0.2.0-rc.2-civilization.0.0.5
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CLI_PACKAGE_JSON = resolve(import.meta.dirname, '../apps/cli/package.json')

function main(): void {
  const content = readFileSync(CLI_PACKAGE_JSON, 'utf8')
  const manifest = JSON.parse(content) as { version: string; [key: string]: unknown }
  const current = manifest.version

  const match = /^(.*-civilization\.)(\d+)\.(\d+)\.(\d+)$/.exec(current)
  if (!match) {
    throw new Error(`Current version "${current}" does not match *-civilization.X.Y.Z pattern`)
  }

  const prefix = match[1] ?? ''
  let major = Number.parseInt(match[2] ?? '0', 10)
  let minor = Number.parseInt(match[3] ?? '0', 10)
  let patch = Number.parseInt(match[4] ?? '0', 10)

  const arg = process.argv[2]
  if (arg === undefined || arg === 'patch') {
    patch += 1
  } else if (arg === 'minor') {
    minor += 1
    patch = 0
  } else if (arg === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (/^\d+\.\d+\.\d+$/.test(arg)) {
    const parts = arg.split('.').map(Number)
    major = parts[0] ?? 0
    minor = parts[1] ?? 0
    patch = parts[2] ?? 0
  } else {
    throw new Error(`Invalid bump argument "${arg}". Expected patch, minor, major, or X.Y.Z`)
  }

  const next = `${prefix}${String(major)}.${String(minor)}.${String(patch)}`
  manifest.version = next
  writeFileSync(CLI_PACKAGE_JSON, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Bumpped @civilization/dsh version: ${current} -> ${next}`)
}

main()
