# Changelog

All notable user-facing changes to dsh-web-ui-notify are documented in this file. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic version tags.

## [0.1.6] - 2026-09-25

Requires dsh `0.1.7-rc.2` or newer: the unified `uiSession.sessionStatus` source this
release reads does not exist on the 0.1.5-era client contract.

### Fixed

- Migrated the client half to the dsh `0.1.7` UI contract, where both sources this plugin was written against are gone:
  - Pending approvals, questions and plan reviews now come from the unified `ctx.uiSession.sessionStatus` map (`ReadonlyMap<SessionId, SessionStatus>`, field `pendingInteraction`) instead of `uiSession.pendingInteractions`, which no longer exists anywhere in the harness.
  - "A session finished while you were elsewhere" now reads `SessionStatus.completionUnread` — dsh's own `completionUnread` flag for a stop observed outside the main view — instead of `SessionSummary.completed`, a field that no longer exists on the session-list row. That check was `undefined === true` forever, so this notification could never fire.
  - The status source has its own subscription: it moves independently of the session list, so reading it from the list subscription left waits and completions unnotified until some unrelated list mutation happened by.
  - The current session's own completion stays with the Chat target's `legacy.turnEnds` layer (unchanged): `completionUnread` is deliberately about the sessions you are NOT looking at.
- A finished turn is no longer announced as "finished" whatever happened: the notification now reads the turn's `turn/end` reason from the Chat timeline and says what actually happened — `max-tokens` → "turn cut off", `error` → "turn failed" (with the harness failure message), `aborted` → "turn stopped" (with a hook's own stop reason when it supplied one), `blocked` / `interrupted` likewise. A turn with no final assistant text is normal (a concluding tool, a structured-output subagent, a PTC script), so the absence of text never drives copy; the synthetic `forked` closer is not announced at all.

### Changed

- Desktop notifications are coordinated across the tabs of one browser: an event is announced **once**, not once per open tab. A tab that is visible *and* shows the event's session suppresses the announcement everywhere (the user is already looking at it); otherwise the election prefers a visible tab, then the lowest page id, and the other candidates take over when the elected tab never reports back (a frozen or discarded background tab).
- Notification tags are session-scoped — `${sid}:${wait.key}`, `${sid}:turn:${turn}`, `${sid}:done` — so two sessions' notifications can no longer replace each other.
- "Already shown" keys are remembered across pages and across a reload, so a still-pending approval or question is not re-announced when the page reloads or another tab opens. A session's completion reminder re-arms when its flag drops (it is recurring, unlike a wait key or a turn number).

## [0.1.5] - 2026-09-14

### Fixed

- Migrated the client half to the dsh `0.1.2-alpha.2`+ UI contract (re-verified against `0.1.5-alpha.2`): turn completion reads the Chat target's `legacy` slice, and pending approvals/questions come from `uiSession.pendingInteractions` instead of the removed `SessionSnapshot` fields. Before this, every scan threw on each change and no notification ever fired. (This work lived only on `main`: the published `0.1.4` tarball still carries the pre-migration build.)
- Replaced the removed `@deepseek-ai/dsh-client-runtime` type imports with their current homes: `@deepseek-ai/cordis` (`Context`), `@deepseek-ai/dsh-session/types` (`SessionId`), `@deepseek-ai/dsh-api-session-controller/client` (`ISessions`), `@deepseek-ai/dsh-client-ui-conversation/client` (`ConversationNode`).
- `dsh.client.inject` now lists the real client-module edges this plugin consumes — `ui-renderer` (`ctx.slots`), `locale`, `ui-settings`, `ui-chat` (the `legacy` slice), `api-session-controller` (`ctx.sessions`), `ui-approval` / `ui-user-questions` (the pending-interaction payloads). The previous three-name list carried a dangling `ui-slots` edge (a types-only package that is not a client row) and missed the packages whose declarations and contributions the plugin actually depends on.
- `scripts/build.mjs` links every workspace package by name (`packages/*/*` and `vendor/*`) instead of a hardcoded list that still named the removed `dsh-client-runtime` and omitted `ui-session`/`ui-conversation`, so `tsc` failed before `tsdown` ever ran.
- `vitest.config.ts` no longer requires the removed `packages/client/runtime` layout; every host package maps to its current source directory.
- Tests updated to the current contract (five-service `inject`, `uiSession`/`uiConversation` bench, flat wait payloads) and now cover the `plan-review` kind.

### Changed

- A degraded notification source now warns once per source, naming the contract, instead of failing silently — a future harness UI-contract change can no longer disable notifications without a trace.
- A `plan-review` wait gets its own title and shows the plan excerpt from the question's `detail`, instead of being reported as an ordinary question.

## [0.1.4] - 2026-08-14

### Changed

- Migrated the repository to the `omdsh-dev` GitHub organization: the package scope is now `@omdsh-dev/dsh-web-ui-notify`, and the repository, homepage, bugs, install/update/remove commands, and community links all point at `github.com/omdsh-dev/dsh-web-ui-notify`. The built `lib/` was re-registered under the new name.

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
