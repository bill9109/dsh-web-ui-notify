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
 *    'plan-review' / 'question') and a whole-session completion flag. The
 *    status is only a TRIGGER: it says "this session has a wait", and the
 *    plugin then resolves the session binding (minting the scope lazily, same
 *    as opening would) to read the wait's full payload. This is what lets a
 *    BACKGROUND session (one you are not looking at) raise a notification —
 *    with its own title, the rich body (approval reason / question text), and
 *    a click that opens it.
 *
 * 2. The SNAPSHOT layer (the CURRENT session only) handles per-turn
 *    completion with the final-text excerpt. The `turnEnds` baseline absorbs a
 *    session's past on first open so history is never re-notified, and replay
 *    re-presents the same numbers so it stays silent.
 *
 * Dedupe is one set of PendingWait keys (`${sid}:${wait.key}`), shared by
 * current and background sessions. Wait keys are stable across mux-open
 * replay, so reconnect (which clears and re-adds the same still-pending
 * waits) never re-fires — the same "同一件事只通知一次，断线重连不会重复响"
 * guarantee the wait-key dedupe gave the current session now covers
 * background sessions too.
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
 * to the session list (background waits + completions) and the current
 * session's snapshot (turn completions), and register the settings row.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
