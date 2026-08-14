# dsh-web-ui-notify — Desktop notifications for approvals / questions / turn completion

[![Release v0.1.3](https://img.shields.io/badge/release-v0.1.3-5B4CF0?style=flat-square)](https://github.com/bill9109/dsh-web-ui-notify/releases/tag/v0.1.3)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-0B7285?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%5E20%20%7C%20%3E%3D22-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)
[![DSH profiles](https://img.shields.io/badge/DSH-Web-5B4CF0?style=flat-square)](cordis.patch.yml)

**Install:** `dsh plugin --profile web add github:bill9109/dsh-web-ui-notify`

**A DeepSeek Harness Web UI client plugin: when a tool needs approval, DSH asks you a question, or a turn finishes while you are looking at another tab, it pops a system desktop notification — so neither DSH nor you end up waiting.**

[English](README.md) | [中文](README.zh.md)

## Why this exists

While you browse other pages, DSH needs human confirmation (tool approvals, questions) or finishes a round of work, and the Web UI in the foreground tab is the only place it asks. If you are looking anywhere else, the request waits silently. This plugin moves those moments onto your desktop: a native system notification appears, names the session, and clicks back into the conversation.

## Features

- **Notify on interaction with the current session**: tool approvals and DSH questions carry context in the body (approvals show the over-permission reason, questions show the question text)
- **Notify on background sessions too**: sessions you are not looking at also notify when they need approval or a question (same contextual body as the current session); a finished background session notifies as well — click it to jump straight to that session
- **Notify on turn completion**: every finished turn of the current session notifies, with the first 80 characters of the final answer; tool-only turns without a final answer show the turn number. Completion, interruption, and error turns all notify
- **Session name in the title**: every notification title names its session, e.g. "Refactor database · needs approval"
- **Click to jump to the session**: clicking a notification not only returns to the DSH page but also opens that session
- Notifies only while you are away from the tab; when the page is in the foreground DSH already shows its own prompts, so it does not double-notify
- Each event notifies once — reconnects do not repeat it, and opening a session with history does not replay old turns
- Notifications do not auto-dismiss after a few seconds; they wait for you
- A toggle lives in Settings → General, following the DSH language (zh/en)

## Install

The plugin is a DSH **bundle** (`package.json` declares `dsh.bundle` + `dsh.client`). Install it into the `web` profile with the standard `dsh plugin` mechanism — **no DSH source changes and no hand-written patch**:

```sh
dsh plugin --profile web add github:bill9109/dsh-web-ui-notify
```

Internally the command runs `pnpm add <spec>` in the profile directory and automatically appends packages that declare `dsh.bundle` to `dsh.profile.bundles`. You can also clone it and install from a local path (for development — rebuild and it takes effect):

```sh
dsh plugin --profile web add /path/to/dsh-web-ui-notify
```

The repository ships its build output (`lib/`), so the plugin works right after installing — no build step needed. It has zero runtime dependencies: the browser-side `require`s (react, react/jsx-runtime, ui-slots) resolve through DSH's own frontend module table, not npm.

> Older DSH (before the profile system) installed via `pnpm --filter @deepseek-ai/dsh add` + `config.yaml`; since the 20260806 snapshot the profile flow above is the way. If your DSH is still old, use the historical README (visible in git history).

After installing, **restart the Web UI** (the way you normally start DSH) and refresh the browser page — the plugin takes effect.

### Upgrade

```sh
dsh plugin --profile web update github:bill9109/dsh-web-ui-notify
```

For a local-path installation, run `add` again against the replacement checkout. User settings (the Settings → General toggle) live in the profile's Settings provider and survive upgrades.

### Uninstall

```sh
dsh plugin --profile web remove @bill9109/dsh-web-ui-notify
```

The command runs `pnpm remove <pkg>` in the profile directory and removes it from `dsh.profile.bundles`. After uninstalling, restart web and hard-refresh the browser.

## Usage

After installation you must also grant browser notification permission, otherwise the plugin stays silent — without permission the browser simply blocks notifications.

1. Open **Settings → General → Desktop notifications** and click **Enable**
2. When the browser asks, choose Allow; the status becomes "Enabled"
3. On macOS, also allow your browser under **System Settings → Notifications**

Then switch to another tab — approvals, questions, or finished turns produce system notifications, and clicking one brings you back to handle it.

The settings row has four states:

| Status | Meaning |
| --- | --- |
| Enabled | Working normally |
| Not granted | Click the button to grant |
| Blocked by browser | Previously denied — change the site setting back to Allow; the button alone will not help |
| Unsupported | The environment has no Notification API |

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| No notifications appear | Confirm the toggle in Settings → General is Enabled, the browser permission for the DSH site is Allow, and on macOS the browser is allowed under System Settings → Notifications; then switch to another tab — the plugin only notifies while you are away |
| Notifications worked, then stopped after a restart | The browser may have reset site permissions; re-grant, or re-enable the toggle if the settings row shows a different state |
| "Blocked by browser" | The site permission was previously denied — change it back to Allow in the browser's site settings; clicking Enable alone will not help |
| "Unsupported" | The environment has no Notification API (e.g. an old or unusual browser); desktop notifications cannot work there |
| Plugin not in Settings → General after install | The plugin only appears after the Web UI is restarted and the page hard-refreshed; verify the bundle row is in the profile (`dsh --profile web --dump-config | grep web-ui-notify`) |

## Development and verification

```sh
pnpm install
pnpm run build     # tsc + tsdown -> lib/ (committed)
pnpm test          # vitest: browser-plugin + settings-row suites
```

`pnpm run build` emits the host + client bundles into `lib/`, which is committed so consumers install without building. The test suite covers plugin wiring on a real cordis context and the settings row in jsdom. Changes that alter the plugin's visible surface (which events notify, the settings row, locales) should add or update coverage in `tests/`.

## Community and About

- Use [GitHub Issues](https://github.com/bill9109/dsh-web-ui-notify/issues) for reproducible bugs, focused feature requests, and usage questions.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes; report vulnerabilities privately via [SECURITY.md](SECURITY.md).
- Follow releases and compatibility notes in [CHANGELOG.md](CHANGELOG.md).

## License

BSD-3-Clause
