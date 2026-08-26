/**
 * tsdown config for the client bundle. The shared clientBundle preset lives
 * in the dsh checkout (packages/client/tsdown.client.ts); scripts/build.mjs
 * resolves the checkout and exports DSH_CHECKOUT before invoking tsdown.
 */
const checkout = process.env.DSH_CHECKOUT
if (checkout === undefined) {
  throw new Error('tsdown.config.mjs: DSH_CHECKOUT is required (run `npm run build`)')
}
const { clientBundle } = await import(`${checkout}/packages/client/tsdown.client.ts`)

export default clientBundle('dsh-web-ui-notify', ['lib/types/index.js'])
