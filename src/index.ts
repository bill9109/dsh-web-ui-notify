/**
 * Node half: a no-op Cordis plugin. All behavior lives in the browser half
 * (src/client, built into lib/client.js), which the web client module system
 * discovers through the package.json `dsh.client` declaration. This half
 * exists so the plugin root is a complete dual-face package and shows up as
 * one entry in the host Loader.
 */

/** Plugin name (= the config entry id). */
export const name = 'dsh-web-ui-notify'

/** No host-side services are used. */
export const inject: string[] = []

/** No host-side behavior for this browser-surface plugin. */
export function apply(): void {}
