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
/** Notification-body cap for a plan under review: keep the system notification compact. */
const PLAN_MAX = 160;
/** Compact one-line excerpt of a possibly-long body; undefined when absent or blank. */
function excerptOf(text, max) {
    if (text === undefined)
        return undefined;
    const trimmed = text.replace(/\s+/gu, ' ').trim();
    if (trimmed === '')
        return undefined;
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}
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
export function fireNotification(wait, t, target) {
    const title = titled(wait.kind === 'approval'
        ? t('notify.approval.title')
        : wait.kind === 'plan-review'
            ? t('notify.plan.title')
            : t('notify.question.title'), target.label);
    let body;
    if (wait.kind === 'approval') {
        body = wait.reason ?? t('notify.approval.body', { toolName: wait.toolName });
    }
    else if (wait.kind === 'plan-review') {
        const first = wait.questions[0];
        body = excerptOf(first?.detail, PLAN_MAX)
            ?? excerptOf(first?.question, PLAN_MAX)
            ?? t('notify.plan.body');
    }
    else {
        body = excerptOf(wait.questions[0]?.question, PLAN_MAX) ?? t('notify.question.bodyGeneric');
    }
    return show(title, body, target.tag, target);
}
/** Title/body copy per non-completed outcome (completed keeps the excerpt copy). */
const TURN_OUTCOME_COPY = {
    'max-tokens': { title: 'notify.turn.maxTokens.title', body: 'notify.turn.maxTokens.body' },
    error: { title: 'notify.turn.error.title', body: 'notify.turn.error.body' },
    aborted: { title: 'notify.turn.aborted.title', body: 'notify.turn.aborted.body' },
    blocked: { title: 'notify.turn.blocked.title', body: 'notify.turn.blocked.body' },
    interrupted: { title: 'notify.turn.interrupted.title', body: 'notify.turn.interrupted.body' },
};
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
export function fireTurnNotification(turn, summary, facts, t, target) {
    if (facts.outcome !== 'completed') {
        const copy = TURN_OUTCOME_COPY[facts.outcome];
        const body = facts.detail !== undefined && facts.detail !== ''
            ? facts.detail
            : t(copy.body, { turn: String(turn) });
        return show(titled(t(copy.title), target.label), body, target.tag, target);
    }
    const body = summary !== undefined && summary !== ''
        ? summary
        : t('notify.turn.body', { turn: String(turn) });
    return show(titled(t('notify.turn.title'), target.label), body, target.tag, target);
}
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
export function fireSessionDoneNotification(t, target) {
    return show(titled(t('notify.sessionDone.title'), target.label), t('notify.other.done.body'), target.tag, target);
}
