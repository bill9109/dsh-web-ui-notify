# dsh-web-ui-notify — Desktop notifications for approvals / questions / turn completion

[English](README.en.md) | [中文](README.md)

A DeepSeek Harness Web UI client plugin: when a tool needs approval, DSH asks you a question, or a turn finishes while you are looking at another tab, it pops a system desktop notification — so neither DSH nor you end up waiting.

License BSD-3-Clause · [GitHub](https://github.com/bill9109/dsh-web-ui-notify)

## Features

While you browse other pages, DSH notifies you through the system whenever it needs human confirmation or has finished a round of work.

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

The plugin is a DSH **bundle** (`package.json` declares `dsh.bundle` + `dsh.client`). Install it into a profile with the standard `dsh plugin` mechanism — **no DSH source changes and no hand-written patch**:

```sh
dsh plugin --profile web add github:bill9109/dsh-web-ui-notify
```

Internally the command runs `pnpm add <spec>` in the profile directory and automatically appends packages that declare `dsh.bundle` to `dsh.profile.bundles`. You can also clone it and install from a local path (for development — rebuild and it takes effect):

```sh
dsh plugin --profile web add /path/to/dsh-web-ui-notify
```

The repository ships its build output (`lib/`), so the plugin works right after installing — no build step needed. It has zero runtime dependencies: the browser-side `require`s (react, react/jsx-runtime, ui-slots) resolve through DSH’s own frontend module table, not npm.

> Older DSH (before the profile system) installed via `pnpm --filter @deepseek-ai/dsh add` + `config.yaml`; since the 20260806 snapshot the profile flow above is the way. If your DSH is still old, use the historical README (visible in git history).

After installing, **restart the Web UI** (the way you normally start DSH) and refresh the browser page — the plugin takes effect.

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

## Uninstall

```sh
dsh plugin --profile web remove @dsh-external/dsh-web-ui-notify
```

Internally the command runs `pnpm remove <pkg>` in the profile directory and removes it from `dsh.profile.bundles`. After uninstalling, restart web and hard-refresh the browser.

## License

BSD-3-Clause
