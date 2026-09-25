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
import { copyFileSync, lstatSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isCheckout, linkCheckout, resolveCheckout } from './dsh-link.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

const checkout = resolveCheckout()
if (!isCheckout(checkout)) {
  throw new Error(`build: ${checkout} is not a dsh checkout (packages/client/tsdown.client.ts missing)`)
}
console.log(`build: using dsh checkout ${checkout}`)

/**
 * The clientBundle preset reads the plugin's own manifest out of the checkout
 * workspace (packages/<group>/<name>/package.json, located BY PACKAGE NAME),
 * because tsdown evaluates every package config with the repository root as
 * cwd. An out-of-repo plugin must therefore be staged under the checkout's
 * external-plugins group for the duration of the build.
 *
 * Staged as a real directory holding a copy of package.json, not a symlink:
 * the preset discovers the workspace with globSync, which does not descend
 * into symlinked directories. Only the manifest is read from there — sources
 * still build from the plugin's own root.
 * @returns disposer removing the staged directory.
 */
function stageIntoWorkspace() {
  const group = join(checkout, 'packages', 'external-plugins')
  const target = join(group, MANIFEST.name)
  let existing
  try {
    existing = lstatSync(target)
  } catch {
    existing = undefined
  }
  if (existing !== undefined && !existing.isSymbolicLink()) {
    throw new Error(`build: ${target} already exists and is not a staging leftover — refusing to replace it`)
  }
  if (existing !== undefined) rmSync(target, { force: true })
  mkdirSync(target, { recursive: true })
  copyFileSync(join(ROOT, 'package.json'), join(target, 'package.json'))
  console.log(`build: staged the manifest under ${join('packages', 'external-plugins', MANIFEST.name)}`)
  return () => rmSync(target, { recursive: true, force: true })
}

const unlink = linkCheckout(checkout, ROOT)
const unstage = stageIntoWorkspace()
let failed = false
try {
  const bin = join(checkout, 'node_modules', '.bin')
  const run = (name, args) => {
    const result = spawnSync(join(bin, name), args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DSH_CHECKOUT: checkout },
    })
    if (result.status === 0) return true
    failed = true
    return false
  }
  // tsc first: tsdown's node-half entry is lib/types/index.js, a tsc output.
  // No process.exit on failure: the finally block must still run, or the
  // build-only links are left behind in the repo and in the checkout.
  if (run('tsc', ['-p', 'tsconfig.json']) && run('tsdown', ['-c', 'tsdown.config.mjs'])) {
    console.log('build: done — lib/ ready (lib/index.js + lib/client.js)')
  }
} finally {
  unstage()
  unlink()
}
if (failed) process.exitCode = 1
