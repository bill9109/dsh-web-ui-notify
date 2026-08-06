/**
 * Approval-notification plugin, browser half: when an approval or question
 * wait lands on the current session, or a turn finishes, while the page is
 * hidden (the user is on another tab), show a desktop Notification. A
 * General-settings row exposes the permission request button — the
 * user-gesture entry point the browser requires before `new Notification`
 * works.
 *
 * Observation model: the composer chain is where approval/question waits
 * "pop up" in the UI, and it serves the CURRENT session only. Subscribing to
 * the current session's conversation snapshot therefore matches the pop-up
 * semantics exactly — non-current sessions' waits surface only once opened
 * (their buffered frames replay), which is also when a notification is
 * meaningful. Dedupe keys are the PendingWait keys (`a:<rpcId>`/`q:<rpcId>`),
 * stable across mux-open replay by construction. Turn completion is read off
 * the snapshot's `turnEnds` map: the first scan of a session absorbs the
 * current map as baseline (no history spam), later scans notify only for
 * turn numbers not seen before — replay re-presents the same numbers, so it
 * stays silent.
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
 * to the current session's pending waits and turn completions, and register
 * the settings row.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
