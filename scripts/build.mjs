#!/usr/bin/env node
/**
 * Build lib/ (node half + browser bundle) using a dsh checkout's toolchain:
 * typescript, tsdown, and the shared clientBundle preset. Dependency
 * resolution goes through a temporary node_modules symlink into the checkout,
 * so no npm install is needed and versions always match the running harness.
 *
 * Usage:  DSH_CHECKOUT=/path/to/dsh node scripts/build.mjs
 *         (or just `npm run build` when `dsh` is on PATH)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

/** Locate the dsh checkout: DSH_CHECKOUT wins, else walk the `dsh` launcher symlink chain. */
function resolveCheckout() {
  if (process.env.DSH_CHECKOUT !== undefined && process.env.DSH_CHECKOUT !== '') {
    return resolve(process.env.DSH_CHECKOUT)
  }
  const which = spawnSync('command', ['-v', 'dsh'], { shell: true, encoding: 'utf8' })
  const launcher = which.stdout.trim()
  if (launcher === '') {
    throw new Error('build: cannot find a dsh checkout — set DSH_CHECKOUT=/path/to/dsh')
  }
  // <checkout>/apps/cli/lib/bin.js  ->  up three levels from the resolved bin
  let dir = dirname(realpathSync(launcher))
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'packages', 'client', 'tsdown.client.ts'))) return dir
    dir = dirname(dir)
  }
  throw new Error(`build: resolved dsh at ${launcher} but found no checkout above it — set DSH_CHECKOUT`)
}

const checkout = resolveCheckout()
if (!existsSync(join(checkout, 'packages', 'client', 'tsdown.client.ts'))) {
  throw new Error(`build: ${checkout} is not a dsh checkout (packages/client/tsdown.client.ts missing)`)
}
console.log(`build: using dsh checkout ${checkout}`)

/** Find one workspace package directory by its package.json name. */
function findWorkspacePackage(name) {
  const packages = join(checkout, 'packages')
  for (const group of readdirSync(packages, { withFileTypes: true })) {
    if (!group.isDirectory()) continue
    const groupDir = join(packages, group.name)
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgFile = join(groupDir, entry.name, 'package.json')
      if (!existsSync(pkgFile)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
        if (pkg?.name === name) return join(groupDir, entry.name)
      } catch {
        // not a package directory
      }
    }
  }
  return undefined
}

// Link the checkout's node_modules so tsc/tsdown resolve the toolchain and
// @deepseek-ai/* from the harness installation.
const link = join(ROOT, 'node_modules')
rmSync(link, { recursive: true, force: true })
symlinkSync(join(checkout, 'node_modules'), link, 'dir')

try {
  // Workspace packages are not hoisted to the root node_modules; link the ones
  // this plugin imports (value import: ui-slots; type-only: runtime, locale).
  const scope = join(link, '@deepseek-ai')
  mkdirSync(scope, { recursive: true })
  for (const name of [
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-locale',
  ]) {
    const target = join(scope, name.slice(name.lastIndexOf('/') + 1))
    if (existsSync(target)) continue
    const pkgDir = findWorkspacePackage(name)
    if (pkgDir !== undefined) symlinkSync(pkgDir, target, 'dir')
    else console.warn(`build: workspace package ${name} not found under packages/`)
  }

  // pnpm does not hoist react/@types/react to the root; pull them from the store.
  const store = join(checkout, 'node_modules', '.pnpm')
  if (!existsSync(join(link, 'react', 'package.json'))) {
    const reactDir = readdirSync(store).find(n => n.startsWith('react@'))
    if (reactDir !== undefined) symlinkSync(join(store, reactDir, 'node_modules', 'react'), join(link, 'react'), 'dir')
  }
  const typesDir = join(link, '@types')
  if (!existsSync(join(typesDir, 'react', 'package.json'))) {
    const reactTypes = readdirSync(store).find(n => n.startsWith('@types+react@'))
    if (reactTypes !== undefined) {
      mkdirSync(typesDir, { recursive: true })
      symlinkSync(join(store, reactTypes, 'node_modules', '@types', 'react'), join(typesDir, 'react'), 'dir')
    }
  }

  const bin = join(checkout, 'node_modules', '.bin')
  const run = (name, args) => {
    const result = spawnSync(join(bin, name), args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DSH_CHECKOUT: checkout },
    })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  // tsc first: tsdown's node-half entry is lib/types/index.js, a tsc output.
  run('tsc', ['-p', 'tsconfig.json'])
  run('tsdown', ['-c', 'tsdown.config.mjs'])
} finally {
  // Drop the build-only link so packaging never picks it up.
  rmSync(link, { recursive: true, force: true })
}
console.log('build: done — lib/ ready (lib/index.js + lib/client.js)')
