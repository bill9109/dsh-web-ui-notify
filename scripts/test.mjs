#!/usr/bin/env node
/**
 * Run the spec suite against a dsh checkout's toolchain (vitest, jsdom, React)
 * and the checkout's host packages — through the same temporary node_modules
 * link scripts/build.mjs uses, so no npm install is needed.
 *
 * Usage:  DSH_CHECKOUT=/path/to/dsh node scripts/test.mjs [-- <vitest args>]
 *         (or just `npm test` when `dsh` is on PATH)
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { isCheckout, linkCheckout, resolveCheckout } from './dsh-link.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const checkout = resolveCheckout()
if (!isCheckout(checkout)) {
  throw new Error(`test: ${checkout} is not a dsh checkout (packages/client/tsdown.client.ts missing)`)
}
console.log(`test: using dsh checkout ${checkout}`)

const unlink = linkCheckout(checkout, ROOT)
try {
  const result = spawnSync(
    join(checkout, 'node_modules', '.bin', 'vitest'),
    ['run', ...process.argv.slice(2)],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, DSH_CHECKOUT: checkout } },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
} finally {
  unlink()
}
