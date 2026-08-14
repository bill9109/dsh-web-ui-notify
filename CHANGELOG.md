# Changelog

All notable user-facing changes to dsh-web-ui-notify are documented in this file. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic version tags.

## [Unreleased]

## [0.1.3] - 2026-08-14

### Changed

- Repositioned the README around the project's role as a DeepSeek Harness Web UI client plugin, in the shared bilingual convention: `README.md` (English) is now the main file, `README.zh.md` carries the Chinese side, and `README.i18n.yaml` records their git blob hashes with a `scripts/verify-i18n.mjs` consistency check.
- Added versioned static badges, a one-line install command, and sections for Why this exists, Upgrade/Uninstall lifecycle, Troubleshooting, and Development and verification.
- Expanded `package.json` metadata: English description, `keywords`, `engines`, the `./cordis.patch.yml` export, and README files in `files`.
- Added `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, and `CODE_OF_CONDUCT.md`.

## [0.1.2] - 2026-08-13

### Changed

- Adapted to the dsh 20260812 snapshot: test-runtime package move and `SlotRegistry` / `LocaleRuntime` renames.
- Renamed the package scope `@dsh-external` → `@bill9109` (repositories live under `github.com/bill9109`); the built `lib/` was rebuilt with the new registration name.
