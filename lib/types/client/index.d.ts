/**
 * Approval-notification plugin, browser half: when an approval or question
 * wait lands, or a turn finishes, while the page is hidden (the user is on
 * another tab), show a desktop Notification. Titles name the source session,
 * and clicking a notification jumps to that exact conversation. A
 * General-settings row exposes the permission request button — the
 * user-gesture entry point the browser requires before `new Notification`
 * works.
 *
 * Observation model — two layers:
 *
 * 1. The STATUS layer (`ctx.uiSession.sessionStatus`, every session) is the
 *    sidebar-dot signal: dsh publishes one `SessionStatus` per session with
 *    `running`, `pendingInteraction` ('approval' / 'plan-review' /
 *    'question'), and `completionUnread` — a stop observed outside the main
 *    view that still needs acknowledgement. The status IS the trigger and the
 *    payload, so a BACKGROUND session (one you are not looking at) raises a
 *    notification with its own title, the rich body (approval reason /
 *    question text), and a click that opens it.
 *
 * 2. The SNAPSHOT layer (the CURRENT session only) handles per-turn
 *    completion with the final-text excerpt. The `turnEnds` baseline absorbs a
 *    session's past on first open so history is never re-notified, and replay
 *    re-presents the same numbers so it stays silent.
 *
 * Dedupe is a set of pending-interaction keys (`${sid}:${wait.key}`), stable
 * across replay, so reconnect (which clears and re-adds the same still-pending
 * waits) never re-fires — plus a set of completion-notified session ids,
 * cleared when the flag drops.
 *
 * Contract note (dsh 0.1.7): the 0.1.5-era sources this plugin was written
 * against — `uiSession.pendingInteractions` and `SessionSummary.completed` —
 * no longer exist. Both facts now ride the unified `sessionStatus` map. Every
 * source read is wrapped so the next contract change degrades to one named
 * warning instead of silently disabling notifications.
 *
 * Two more 0.1.7 moves this file had to follow: `SessionListState.current` is
 * gone (the main-view session is now the row retained by `mainView`), and
 * `sessions.open(id)` is gone (navigation belongs to
 * `uiWorkspace.openSession`).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ConversationNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { type NotifyKey } from './locales.ts';
import { type PageCoordination } from './pages.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The web-ui-notify surfaces' copy (settings row + notification titles). */
        'web-ui-notify': NotifyKey;
    }
}
/**
 * Extract a compact excerpt of one turn's final assistant text for the
 * notification body: the LAST assistant node of that turn, text blocks joined
 * and truncated. A tool-only turn (no final text) yields undefined, so the
 * caller falls back to the turn-number copy.
 * @param nodes - the conversation nodes in event order.
 * @param turn - the finished turn number.
 * @returns the excerpt, or undefined when the turn produced no final text.
 */
export declare function turnSummaryOf(nodes: readonly ConversationNode[], turn: number): string | undefined;
/** Required services: the settings slots registry, session domain, locale, and the
 * UI session/conversation faces that carry the unified session status and the
 * chat snapshot sources. */
export declare const inject: string[];
/**
 * Client plugin body: register the `web-ui-notify` dictionaries, subscribe to
 * the unified session-status source (background waits + completions) and the
 * current session's chat snapshot (turn completions), and register the
 * settings row.
 * @param ctx - client root context.
 * @param options - test seam: an injected cross-page coordinator.
 */
export declare function apply(ctx: ClientContext, options?: {
    readonly pages?: PageCoordination | undefined;
}): void;
