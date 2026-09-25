/**
 * Test config for the standalone plugin repo. The specs import host packages
 * (@deepseek-ai/dsh-*), which are not published to npm — they resolve to
 * SOURCES inside a dsh checkout, mirroring how the checkout's own vitest maps
 * them through tsconfig paths. Mapping to src (never a built lib/) also keeps
 * cordis a single module instance across the plugin and the host code.
 *
 * The alias table is DERIVED from the checkout's workspace layout instead of a
 * hardcoded package list. A hardcoded list is how this file kept pointing at
 * the removed `packages/client/runtime` long after the harness had moved on,
 * which made the suite impossible to run at all.
 *
 * Usage:  DSH_CHECKOUT=/path/to/dsh node scripts/test.mjs
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { isCheckout, workspacePackages } from './scripts/dsh-link.mjs'

const checkout = resolve(process.env.DSH_CHECKOUT ?? '../test-omdsh-dev')
if (!isCheckout(checkout)) {
  throw new Error(`vitest.config.ts: ${checkout} is not a dsh checkout — set DSH_CHECKOUT=/path/to/dsh`)
}

/** Source alias for every workspace subpath the checkout's convention defines. */
function sourceAliases() {
  const aliases = []
  for (const [name, dir] of workspacePackages(checkout)) {
    const src = join(dir, 'src')
    const candidates = [
      // Package root and /client map to their source DIRECTORY, so deeper
      // specifiers (e.g. `<pkg>/client/registry.ts`) keep resolving.
      [`${name}/client`, join(src, 'client')],
      [`${name}/types`, join(src, 'types.ts')],
      // The checkout's own packages deep-import each other as `<pkg>/src/...`.
      [`${name}/src`, src],
      [name, src],
    ]
    for (const [find, replacement] of candidates) {
      const probe = replacement.endsWith('.ts') ? replacement : join(replacement, 'index.ts')
      if (existsSync(probe)) aliases.push({ find, replacement })
    }
  }
  // Subpaths must win over the bare package root.
  return aliases.sort((left, right) => right.find.length - left.find.length)
}

export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
})
