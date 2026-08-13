/**
 * Test config for the standalone plugin repo. The specs import host packages
 * (@deepseek-ai/dsh-client-*), which are not published to npm — they resolve
 * to SOURCES inside a dsh checkout, mirroring how the checkout's own vitest
 * maps them through tsconfig paths. Mapping to src (never a built lib/) also
 * keeps cordis a single module instance across the plugin and the host code.
 *
 * Usage:  DSH_CHECKOUT=/path/to/dsh npx vitest run
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const checkout = resolve(process.env.DSH_CHECKOUT ?? '../test-bill9109')
if (!existsSync(join(checkout, 'packages', 'client', 'runtime', 'src'))) {
  throw new Error(`vitest.config.ts: ${checkout} is not a dsh checkout — set DSH_CHECKOUT=/path/to/dsh`)
}
const pkg = (...segments: string[]): string => join(checkout, 'packages', ...segments)

export default defineConfig({
  resolve: {
    // Longest specifier first: '/client' subpaths must match before the roots.
    alias: [
      { find: '@deepseek-ai/dsh-client-runtime/client', replacement: pkg('client', 'runtime', 'src', 'client') },
      { find: '@deepseek-ai/dsh-client-locale/client', replacement: pkg('client', 'locale', 'src', 'client') },
      { find: '@deepseek-ai/dsh-client-ui-settings/client', replacement: pkg('client', 'ui-settings', 'src', 'client') },
      // dsh-client-test-runtime moved from packages/client/test-runtime to
      // packages/test-support/client-runtime in the 20260812 snapshots.
      { find: '@deepseek-ai/dsh-client-test-runtime', replacement: pkg('test-support', 'client-runtime', 'src') },
      { find: '@deepseek-ai/dsh-client-runtime', replacement: pkg('client', 'runtime', 'src') },
      { find: '@deepseek-ai/dsh-client-ui-slots', replacement: pkg('client', 'ui-slots', 'src') },
      { find: '@deepseek-ai/dsh-client-locale', replacement: pkg('client', 'locale', 'src') },
      { find: '@deepseek-ai/cordis', replacement: join(checkout, 'vendor', 'cordis', 'src') },
    ],
  },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
})
