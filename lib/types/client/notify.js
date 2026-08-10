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
/**
 * Attach the click-to-jump behavior shared by every notification this plugin
 * builds: raise the window, jump to the source conversation, and dismiss.
 */
function withClickFocus(notification, onOpen) {
    notification.onclick = () => {
        window.focus();
        onOpen();
        notification.close();
    };
    return notification;
}
/** Compose a notification title: the session label first, then the kind title. */
function titled(kindTitle, label) {
    return label === '' ? kindTitle : `${label} · ${kindTitle}`;
}
/** The one rendering path every notification kind funnels through. */
function show(title, body, tag, target) {
    return withClickFocus(new Notification(title, { body, tag, requireInteraction: true }), target.onOpen);
}
/**
 * Build and show the desktop notification for one pending wait. The caller
 * gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * wait key; this function only renders.
 * @param wait - the pending approval or question interaction.
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler.
 * @returns the constructed Notification (tests assert on it).
 */
export function fireNotification(wait, t, target) {
    const title = titled(wait.kind === 'approval' ? t('notify.approval.title') : t('notify.question.title'), target.label);
    const body = wait.kind === 'approval'
        ? (wait.payload.reason ?? t('notify.approval.body', { toolName: wait.payload.toolName }))
        : (() => {
            const first = wait.payload.questions[0];
            return first?.question !== undefined && first.question !== ''
                ? first.question
                : t('notify.question.bodyGeneric');
        })();
    return show(title, body, wait.key, target);
}
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
export function fireTurnNotification(turn, summary, t, target) {
    const body = summary !== undefined && summary !== ''
        ? summary
        : t('notify.turn.body', { turn: String(turn) });
    return show(titled(t('notify.turn.title'), target.label), body, `turn:${turn}`, target);
}
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
export function fireSessionNotification(kind, t, target) {
    switch (kind) {
        case 'approval':
            return show(titled(t('notify.approval.title'), target.label), t('notify.other.approval.body'), target.tag, target);
        case 'question':
            return show(titled(t('notify.question.title'), target.label), t('notify.other.question.body'), target.tag, target);
        case 'done':
            return show(titled(t('notify.sessionDone.title'), target.label), t('notify.other.done.body'), target.tag, target);
    }
}
