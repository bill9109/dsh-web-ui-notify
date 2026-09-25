/**
 * Pure notification helpers: visibility check, permission gate, and the
 * Notification construction for one pending wait, one completed turn, or one
 * background-session event. Kept side-effect-free (beyond constructing
 * Notification) so the browser-plugin spec can drive them with a stub
 * Notification and a fake visibilityState.
 */
import type { SessionPendingInteraction } from '@deepseek-ai/dsh-client-ui-session/client';
import type { NotifyKey } from './locales.ts';
/** Locale translate function shape (the bound `t` from ctx.locale). */
export type Translate = (key: NotifyKey, params?: Record<string, string>) => string;
/** What clicking a notification does: focus the window, then jump to the source conversation. */
export type OpenHandler = () => void;
/**
 * Session-target bundle every notification carries: the session's display
 * label (for the title) and the click-to-jump handler (which opens that
 * conversation in the web UI).
 */
export interface NotifyTarget {
    /** Session display label appended to the title, e.g. "重构数据库 · 需要审批". */
    label: string;
    /** Click-to-jump handler (open the source conversation). */
    onOpen: OpenHandler;
}
/**
 * Whether the page is currently hidden (the user is on another tab).
 * @returns true when the document visibility state is 'hidden'.
 */
export declare function hiddenNow(): boolean;
/**
 * Whether the browser supports the Notification API and has granted permission.
 * @returns true when `new Notification` may be constructed.
 */
export declare function notificationUsable(): boolean;
/**
 * Build and show the desktop notification for one pending wait. The caller
 * gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * wait key; this function only renders.
 *
 * Three wait kinds reach this renderer: `approval`, `question`, and the
 * `plan-review` intent of a question. A plan review is its own thing — its
 * plan markdown rides the question's `detail` — so it gets its own title and
 * body instead of being reported as an ordinary question.
 * @param wait - the pending approval, question, or plan-review interaction.
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler + the session-scoped tag
 *   (`${sid}:${wait.key}`), so two sessions' waits can never replace each other.
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireNotification(wait: SessionPendingInteraction, t: Translate, target: NotifyTarget & {
    tag: string;
}): Notification;
/**
 * How one turn ended. Mirrors the harness `TurnEndReason` kinds this plugin
 * reports; `forked` is absent because it is a synthetic closer the fork
 * machinery writes, never something that happened in this client.
 */
export type TurnOutcome = 'completed' | 'max-tokens' | 'error' | 'aborted' | 'blocked' | 'interrupted';
/**
 * Turn-end facts a notification reports: the outcome, plus whatever detail the
 * harness carried (an LLM failure message, or a hook's stop reason).
 */
export interface TurnEndFacts {
    /** Why the turn ended. */
    readonly outcome: TurnOutcome;
    /** Harness-supplied detail; when absent the copy's own turn sentence is used. */
    readonly detail?: string | undefined;
}
/**
 * Build and show the desktop notification for a finished turn. A turn that
 * produced no final assistant text is normal — a concluding tool
 * (`concludesTurn`), a structured-output subagent, a PTC script that ends the
 * loop — so only the outcome decides the copy, never the absence of text. The
 * caller gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * turn; this function only renders.
 * @param turn - the finished turn number.
 * @param summary - optional excerpt of the turn's final assistant text; when
 *   absent (a tool-only turn) a completed turn falls back to the turn copy.
 * @param facts - why the turn ended (see {@link TurnEndFacts}).
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler + the session-scoped tag
 *   (`${sid}:turn:${turn}`), so two sessions' turn numbers cannot collide.
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireTurnNotification(turn: number, summary: string | undefined, facts: TurnEndFacts, t: Translate, target: NotifyTarget & {
    tag: string;
}): Notification;
/**
 * Build and show the desktop notification for a whole background session
 * finishing ("done" reminder). The caller gates on {@link hiddenNow} /
 * {@link notificationUsable} and dedupes per session; this function only
 * renders.
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler + a unique tag so the
 *   browser never replaces one session's notification with another's.
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireSessionDoneNotification(t: Translate, target: NotifyTarget & {
    tag: string;
}): Notification;
