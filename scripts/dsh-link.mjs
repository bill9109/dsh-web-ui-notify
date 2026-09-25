/**
 * Shared dsh-checkout plumbing for scripts/build.mjs and scripts/test.mjs:
 * locate the checkout, and expose the build-only node_modules link that lets
 * tsc / tsdown / vitest resolve both the toolchain and every @deepseek-ai/*
 * workspace package without an npm install.
 *
 * The workspace package set is DISCOVERED from the checkout, never hardcoded:
 * which packages a client plugin resolves moves with the harness version, and
 * a stale list fails as an unexplained "Cannot find module '@deepseek-ai/dsh-…'".
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Locate the dsh checkout: DSH_CHECKOUT wins, else walk the `dsh` launcher symlink chain. */
export function resolveCheckout() {
  if (process.env.DSH_CHECKOUT !== undefined && process.env.DSH_CHECKOUT !== '') {
    return resolve(process.env.DSH_CHECKOUT)
  }
  const which = spawnSync('command', ['-v', 'dsh'], { shell: true, encoding: 'utf8' })
  const launcher = which.stdout.trim()
  if (launcher === '') {
    throw new Error('dsh: cannot find a dsh checkout — set DSH_CHECKOUT=/path/to/dsh')
  }
  // <checkout>/apps/cli/lib/bin.js -> up six levels from the resolved bin.
  let dir = dirname(realpathSync(launcher))
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'packages', 'client', 'tsdown.client.ts'))) return dir
    dir = dirname(dir)
  }
  throw new Error(`dsh: resolved dsh at ${launcher} but found no checkout above it — set DSH_CHECKOUT`)
}

/** Whether a directory is a dsh source checkout this tooling can build against. */
export function isCheckout(checkout) {
  return existsSync(join(checkout, 'packages', 'client', 'tsdown.client.ts'))
}

/** Every workspace package name -> its directory, across packages/*\/* and vendor/*. */
export function workspacePackages(checkout) {
  const found = new Map()
  for (const groupDir of [join(checkout, 'packages'), join(checkout, 'vendor')]) {
    if (!existsSync(groupDir)) continue
    for (const group of readdirSync(groupDir, { withFileTypes: true })) {
      if (!group.isDirectory()) continue
      const groupPath = join(groupDir, group.name)
      const dirs = existsSync(join(groupPath, 'package.json'))
        ? [groupPath]
        : readdirSync(groupPath, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => join(groupPath, entry.name))
      for (const dir of dirs) {
        const pkgFile = join(dir, 'package.json')
        if (!existsSync(pkgFile)) continue
        try {
          const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
          if (typeof pkg?.name === 'string' && !found.has(pkg.name)) found.set(pkg.name, dir)
        } catch {
          // not a package directory
        }
      }
    }
  }
  return found
}

/**
 * Link `<root>/node_modules` at the checkout's install, then expose every
 * workspace package inside it. Returns the disposer that drops the link so
 * packaging never picks it up.
 * @param checkout - resolved dsh checkout.
 * @param root - repository root that receives the temporary link.
 */
export function linkCheckout(checkout, root) {
  const link = join(root, 'node_modules')
  rmSync(link, { recursive: true, force: true })
  symlinkSync(join(checkout, 'node_modules'), link, 'dir')

  // Workspace packages are not hoisted to the root node_modules.
  const scope = join(link, '@deepseek-ai')
  mkdirSync(scope, { recursive: true })
  for (const [name, dir] of workspacePackages(checkout)) {
    const target = join(scope, name.slice(name.lastIndexOf('/') + 1))
    if (existsSync(target)) continue
    symlinkSync(dir, target, 'dir')
  }

  // pnpm does not hoist react/@types/react to the root; pull them from the store.
  const store = join(checkout, 'node_modules', '.pnpm')
  if (!existsSync(join(link, 'react', 'package.json'))) {
    const reactDir = readdirSync(store).find(entry => entry.startsWith('react@'))
    if (reactDir !== undefined) symlinkSync(join(store, reactDir, 'node_modules', 'react'), join(link, 'react'), 'dir')
  }
  const typesDir = join(link, '@types')
  if (!existsSync(join(typesDir, 'react', 'package.json'))) {
    const reactTypes = readdirSync(store).find(entry => entry.startsWith('@types+react@'))
    if (reactTypes !== undefined) {
      mkdirSync(typesDir, { recursive: true })
      symlinkSync(join(store, reactTypes, 'node_modules', '@types', 'react'), join(typesDir, 'react'), 'dir')
    }
  }

  return () => rmSync(link, { recursive: true, force: true })
}
