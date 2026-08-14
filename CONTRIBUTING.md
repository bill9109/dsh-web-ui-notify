# Contributing to dsh-web-ui-notify

Focused fixes, tests, and documentation changes are welcome. By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

1. Read [README.md](README.md) — install, usage, and troubleshooting.
2. Search existing [issues](https://github.com/omdsh-dev/dsh-web-ui-notify/issues) and pull requests before opening duplicate work.
3. Open an issue before changing the notification surface (which events notify, the settings row, locales) or the bundle manifest.
4. Keep each change narrowly scoped. Do not mix a feature or fix with unrelated refactoring or generated-output churn.

## Architecture and scope

dsh-web-ui-notify is an out-of-tree DeepSeek Harness Web client plugin. Contributions must preserve these responsibilities:

- The plugin is a standard DSH **bundle** with a node half (no-op, so it appears in the Loader) and a browser half (`dsh.client` declaration + `exports["./client"]`) that does the notification work.
- It notifies only while the tab is hidden; foreground prompts belong to DSH itself.
- Each event notifies once; reconnects and session history must not replay notifications.
- Locales follow the DSH language (zh/en); the settings row lives in Settings → General.

## Development

```sh
pnpm install
pnpm run build   # tsc + tsdown -> lib/ (committed)
pnpm test        # vitest: browser-plugin + settings-row suites
```

Keep the bilingual README in sync (edit both `README.md` and `README.zh.md`, then `node scripts/verify-i18n.mjs --write`).

## Commit and release

- Bump the version and update `CHANGELOG.md` (Keep a Changelog format) in the same change that ships a user-visible difference.
- Tag releases with a semantic version (`v0.1.3`) and push tags with the release.
