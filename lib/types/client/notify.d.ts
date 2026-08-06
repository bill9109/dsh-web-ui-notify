/**
 * Pure notification helpers: visibility check, permission gate, and the
 * Notification construction for one pending wait. Kept side-effect-free
 * (beyond constructing Notification) so the browser-plugin spec can drive
 * them with a stub Notification and a fake visibilityState.
 */
import type { PendingInteraction } from '@deepseek-ai/dsh-client-runtime/client';
import type { NotifyKey } from './locales.ts';
/** Locale translate function shape (the bound `t` from ctx.locale). */
export type Translate = (key: NotifyKey, params?: Record<string, string>) => string;
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
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireNotification(wait: PendingInteraction, t: Translate): Notification | undefined;
/**
 * Build and show the desktop notification for a completed turn. The caller
 * gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * turn; this function only renders.
 * @param turn - the completed turn number.
 * @param summary - optional excerpt of the turn's final assistant text; when
 *   absent (a tool-only turn) the notification falls back to the turn number.
 * @param t - bound locale translate for the plugin namespace.
 * @returns the constructed Notification (tests assert on it).
 */
export declare function fireTurnNotification(turn: number, summary: string | undefined, t: Translate): Notification | undefined;
