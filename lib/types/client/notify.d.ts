/**
 * Pure notification helpers: visibility check, permission gate, and the
 * Notification construction for one pending wait, one completed turn, or one
 * background-session event. Kept side-effect-free (beyond constructing
 * Notification) so the browser-plugin spec can drive them with a stub
 * Notification and a fake visibilityState.
 */
import type { PendingInteraction } from '@deepseek-ai/dsh-client-runtime/client';
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
 * @param wait - the pending approval or question interaction.
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler.
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireNotification(wait: PendingInteraction, t: Translate, target: NotifyTarget): Notification;
/**
 * Build and show the desktop notification for a completed turn. The caller
 * gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * turn; this function only renders.
 * @param turn - the completed turn number.
 * @param summary - optional excerpt of the turn's final assistant text; when
 *   absent (a tool-only turn) the notification falls back to the turn number.
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler.
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireTurnNotification(turn: number, summary: string | undefined, t: Translate, target: NotifyTarget): Notification;
/** Background-session events reported through the list layer (no per-session payload). */
export type SessionEventKind = 'approval' | 'question' | 'done';
/**
 * Build and show the desktop notification for a background-session event:
 * a pending approval, a pending question, or the whole session finishing.
 * The caller gates on {@link hiddenNow} / {@link notificationUsable} and
 * dedupes per (session, kind); this function only renders.
 * @param kind - the event kind (approval/question use the question-copy for
 *   plan-review, which the list reports as a distinct status).
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler + a unique tag so the
 *   browser never replaces one session's notification with another's.
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireSessionNotification(kind: SessionEventKind, t: Translate, target: NotifyTarget & {
    tag: string;
}): Notification;
