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
 * 1. The LIST layer (all sessions) is the sidebar-dot signal: it reports, for
 *    every listed session, a pending-interaction status ('approval' /
 *    'plan-review' / 'question') and a whole-session completion flag. This is
 *    what lets a BACKGROUND session (one you are not looking at) raise a
 *    notification, with its own title and a click that opens it. No payload
 *    (tool name / reason / question text) exists there, so background waits
 *    use generic body copy. Dedupe is per (session, status): a status that
 *    clears then returns (a new wait) notifies again.
 *
 * 2. The SNAPSHOT layer (the CURRENT session only) is the composer chain —
 *    where waits "pop up" in the UI, serving the current session only. It
 *    carries the full payload, so current-session notifications keep the rich
 *    body (approval reason, question text), plus per-turn completion with the
 *    final-text excerpt. Dedupe keys are the PendingWait keys
 *    (`a:<rpcId>`/`q:<rpcId>`), stable across mux-open replay, and the
 *    `turnEnds` baseline absorbs a session's past on first open so history is
 *    never re-notified.
 *
 * A cross-layer guard prevents double notifications: when a background wait
 * was already notified by the list layer and the session then becomes
 * current, the snapshot layer consumes the guard and stays silent instead of
 * re-firing the same wait with the rich body.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client';
import { type NotifyKey } from './locales.ts';
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
/** Required services: the settings slots registry, session domain, and locale. */
export declare const inject: string[];
/**
 * Client plugin body: register the `web-ui-notify` dictionaries, subscribe
 * to the session list (background events) and the current session's snapshot
 * (rich events), and register the settings row.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
