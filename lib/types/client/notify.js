/**
 * Whether the page is currently hidden (the user is on another tab).
 * @returns true when the document visibility state is 'hidden'.
 */
export function hiddenNow() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}
/**
 * Whether the browser supports the Notification API and has granted permission.
 * @returns true when `new Notification` may be constructed.
 */
export function notificationUsable() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
/** Attach the click-to-focus behavior shared by every notification this plugin builds. */
function withClickFocus(notification) {
    // Clicking a desktop notification on macOS/Windows merely raises the
    // browser unless the page claims the click: focus the window and dismiss.
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
    return notification;
}
/**
 * Build and show the desktop notification for one pending wait. The caller
 * gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * wait key; this function only renders.
 * @param wait - the pending approval or question interaction.
 * @param t - bound locale translate for the plugin namespace.
 * @returns the constructed Notification (tests assert on it).
 */
export function fireNotification(wait, t) {
    const title = wait.kind === 'approval'
        ? t('notify.approval.title')
        : t('notify.question.title');
    const body = wait.kind === 'approval'
        ? (wait.payload.reason ?? t('notify.approval.body', { toolName: wait.payload.toolName }))
        : (() => {
            const first = wait.payload.questions[0];
            return first?.question !== undefined && first.question !== ''
                ? first.question
                : t('notify.question.bodyGeneric');
        })();
    return withClickFocus(new Notification(title, { body, tag: wait.key, requireInteraction: true }));
}
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
export function fireTurnNotification(turn, summary, t) {
    const body = summary !== undefined && summary !== ''
        ? summary
        : t('notify.turn.body', { turn: String(turn) });
    return withClickFocus(new Notification(t('notify.turn.title'), { body, tag: `turn:${turn}`, requireInteraction: true }));
}
