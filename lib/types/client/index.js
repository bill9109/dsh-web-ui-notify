import { NotificationSettingsRow } from "./NotificationSettingsRow.js";
import { en, NS, zh } from "./locales.js";
import { fireNotification, fireSessionDoneNotification, fireTurnNotification, hiddenNow, notificationUsable, } from "./notify.js";
/** Notification-body excerpt cap: keep the system notification compact. */
const SUMMARY_MAX = 80;
/** Session-label cap in notification titles: keep the title bar compact. */
const SESSION_LABEL_MAX = 40;
/**
 * The Session shown in the main view — the one whose turns this client watches
 * and whose own completion is reported by the turn layer rather than the
 * "you were elsewhere" reminder.
 *
 * dsh 0.1.7 dropped `SessionListState.current`, so this mirrors the Workspace
 * browser's rule: the row the main view retains is the selected one.
 * @param list - the session-list snapshot.
 * @returns the main-view session id, or undefined while nothing is shown.
 */
function mainSessionId(list) {
    return Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
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
export function turnSummaryOf(nodes, turn) {
    let text = '';
    for (const node of nodes) {
        if (node.kind !== 'assistant' || node.turn !== turn)
            continue;
        let joined = '';
        for (const block of node.blocks) {
            if (block.kind === 'text')
                joined += block.text;
        }
        if (joined !== '')
            text = joined;
    }
    if (text === '')
        return undefined;
    const trimmed = text.replace(/\s+/gu, ' ').trim();
    return trimmed.length > SUMMARY_MAX ? `${trimmed.slice(0, SUMMARY_MAX)}…` : trimmed;
}
/**
 * Translate one harness turn-end reason into the facts a notification reports,
 * or undefined when nothing should be announced.
 *
 * A turn that ends without a final assistant answer is not an error: a
 * concluding tool (`concludesTurn`), a structured-output subagent, or a PTC
 * script can close a turn legitimately — and a stop or a failure closes one
 * without any answer at all. Only the reason distinguishes them, so the
 * timeline's own `turn/end` event decides the copy.
 * @param reason - the turn's `TurnEndReason`, absent while the end is not loaded.
 * @returns the facts to render, or undefined to stay silent for this turn.
 */
function turnFactsOf(reason) {
    // No turn/end in the loaded window yet: nothing authoritative to report.
    if (reason === undefined)
        return undefined;
    switch (reason.kind) {
        case 'completed':
            return { outcome: 'completed' };
        case 'max-tokens':
            return { outcome: 'max-tokens' };
        case 'blocked':
            return { outcome: 'blocked' };
        case 'interrupted':
            return { outcome: 'interrupted' };
        case 'error':
            // The harness flattens every failure onto the LlmFailure facts.
            return { outcome: 'error', detail: reason.error.message };
        case 'aborted': {
            const cause = reason.reason;
            // A hook's own stop reason is the most useful sentence we have.
            return cause.kind === 'hook' && cause.reason !== ''
                ? { outcome: 'aborted', detail: cause.reason }
                : { outcome: 'aborted' };
        }
        case 'forked':
            // Synthetic closer of a fork boundary; the user did nothing to report.
            return undefined;
        default:
            // A future reason kind: keep the historical "finished" copy.
            return { outcome: 'completed' };
    }
}
/** Required services: the settings slots registry, session domain, locale, and the
 * UI session/conversation faces that carry the unified session status and the
 * chat snapshot sources. */
export const inject = ['slots', 'sessions', 'locale', 'uiConversation', 'uiSession', 'uiWorkspace'];
/**
 * Client plugin body: register the `web-ui-notify` dictionaries, subscribe to
 * the unified session-status source (background waits + completions) and the
 * current session's chat snapshot (turn completions), and register the
 * settings row.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notify: dictionaries');
    const t = ctx.locale.bind(NS);
    const sessions = ctx.sessions;
    /**
     * One-shot degradation report. A scan must never surface as a subscriber
     * error, but a source that silently stops existing is exactly how a harness
     * contract change becomes invisible: warn once per source, naming it.
     */
    const degraded = new Set();
    const degrade = (source, error) => {
        if (degraded.has(source))
            return;
        degraded.add(source);
        console.warn(`[web-ui-notify] ${source} is unavailable — notifications from that source are disabled. ` +
            'This usually means the harness UI contract changed; re-check this plugin against the current dsh version.', error);
    };
    /**
     * Pending-interaction keys already notified, scoped by session
     * (`${sid}:${wait.key}`, stable across replay, so reconnect and mux-open
     * replay stay silent).
     */
    const notified = new Set();
    /** Sessions whose "finished while you were away" reminder was already shown. */
    const completionNotified = new Set();
    /** Completed turn numbers already seen per session (baseline absorbed on first scan). */
    const seenTurns = new Map();
    let unsubSession;
    let watched;
    /** Session display label for notification titles (fallback: the raw id). */
    const labelOf = (sid) => {
        const label = sessions.list.getSnapshot().byId[sid]?.displayTitle ?? sid;
        return label.length > SESSION_LABEL_MAX ? `${label.slice(0, SESSION_LABEL_MAX)}…` : label;
    };
    /** Click-to-jump handler for one notification: focus, then open its session. */
    const openOf = (sid) => () => {
        // The session may have left the list while the notification lingered.
        if (sessions.list.getSnapshot().byId[sid] === undefined)
            return;
        try {
            ctx.uiWorkspace.openSession(sid);
        }
        catch (error) {
            degrade('session navigation (uiWorkspace.openSession)', error);
        }
    };
    /** Scan the current session's chat snapshot; notify newly finished turns.
     *  alpha2 moved turnEnds/nodes off the session snapshot onto the Chat view's
     *  legacy projection, so this reads the chat target. A chat view that is not
     *  materialized yet yields undefined and is simply skipped. The turn's
     *  `turn/end` reason comes from the same snapshot's timeline, so a stopped or
     *  failed turn is not reported as a finished one.
     */
    const scan = () => {
        try {
            const current = mainSessionId(sessions.list.getSnapshot());
            if (current === undefined)
                return;
            const snapshot = ctx.uiConversation.binding(current).target('chat').getSnapshot();
            // No Chat snapshot yet: the view is not materialized during boot. Transient.
            if (snapshot === undefined)
                return;
            // A materialized Chat snapshot without the legacy slice is a contract break.
            if (snapshot.legacy === undefined) {
                degrade('chat legacy slice (ChatSnapshot.legacy)', new Error('ChatSnapshot.legacy is missing'));
                return;
            }
            let turns = seenTurns.get(current);
            if (turns === undefined) {
                turns = new Set(snapshot.legacy.turnEnds.keys());
                seenTurns.set(current, turns);
                return;
            }
            for (const turn of snapshot.legacy.turnEnds.keys()) {
                if (turns.has(turn))
                    continue;
                turns.add(turn);
                const facts = turnFactsOf(snapshot.timeline?.turns.get(turn)?.end?.data.reason);
                // Nothing to announce (a synthetic fork closer): stay silent.
                if (facts === undefined)
                    continue;
                // Only a page bound to this session can see its turns, so the election
                // runs among those pages alone.
                const tag = `${current}:turn:${turn}`;
                if (hiddenNow() && notificationUsable()) {
                    fireTurnNotification(turn, turnSummaryOf(snapshot.legacy.nodes, turn), facts, t, {
                        label: labelOf(current), onOpen: openOf(current), tag,
                    });
                }
            }
        }
        catch (error) {
            // A notification scan must never surface as a subscriber error; the chat
            // source may be absent (non-chat view) or mid-restructure, so degrade —
            // but say so once, so a real contract break cannot pass unnoticed.
            degrade('chat turn source (uiConversation.chat.legacy)', error);
        }
    };
    /**
     * Scan the unified session-status map — the signal that covers sessions you
     * are NOT looking at, which is the point of this plugin:
     *
     * - `pendingInteraction` newly present on ANY session (approval, question or
     *   plan review, current or background) notifies once per interaction key.
     * - `completionUnread` is dsh's own "a session stopped outside the main view
     *   and you have not acknowledged it" flag; it notifies once per session and
     *   re-arms when the flag drops.
     *
     * The status map needs its OWN subscription: it moves independently of the
     * session list, so reading it from the list subscription left approvals and
     * completions unnotified until some unrelated list mutation happened by.
     */
    const scanStatus = () => {
        try {
            const statuses = ctx.uiSession.sessionStatus.getSnapshot();
            const current = mainSessionId(sessions.list.getSnapshot());
            for (const [sid, status] of statuses) {
                const wait = status.pendingInteraction;
                if (wait !== undefined) {
                    const key = `${sid}:${wait.key}`;
                    if (!notified.has(key)) {
                        notified.add(key);
                        if (hiddenNow() && notificationUsable()) {
                            fireNotification(wait, t, { label: labelOf(sid), onOpen: openOf(sid), tag: key });
                        }
                    }
                }
                // A completion of the session shown in the main view is the turn-level
                // case below; this branch is the "you were elsewhere" reminder.
                if (status.completionUnread === true && sid !== current) {
                    if (!completionNotified.has(sid)) {
                        completionNotified.add(sid);
                        if (hiddenNow() && notificationUsable()) {
                            fireSessionDoneNotification(t, {
                                label: labelOf(sid), onOpen: openOf(sid), tag: `${sid}:done`,
                            });
                        }
                    }
                }
                else if (status.completionUnread !== true) {
                    completionNotified.delete(sid);
                }
            }
            // Drop completion state for sessions that left the status map.
            for (const sid of completionNotified) {
                if (!statuses.has(sid))
                    completionNotified.delete(sid);
            }
        }
        catch (error) {
            // Status source unavailable; skip notifications from it, keep the rest.
            degrade('session-status source (uiSession.sessionStatus)', error);
        }
    };
    /** Re-subscribe to the current session's chat snapshot when `current` moves. */
    const watchCurrent = () => {
        const current = mainSessionId(sessions.list.getSnapshot());
        if (current === watched)
            return;
        unsubSession?.();
        unsubSession = undefined;
        watched = current;
        if (current === undefined)
            return;
        try {
            const chat = ctx.uiConversation.binding(current).target('chat');
            unsubSession = chat.subscribe(scan);
        }
        catch (error) {
            unsubSession = undefined;
            degrade('chat snapshot subscription (uiConversation.chat)', error);
        }
        scan();
    };
    const unsubList = sessions.list.subscribe(() => { watchCurrent(); });
    const unsubStatus = ctx.uiSession.sessionStatus.subscribe(scanStatus);
    watchCurrent();
    scanStatus();
    ctx.effect(() => () => {
        unsubList();
        unsubStatus();
        unsubSession?.();
    }, 'ui-notify: session subscription');
    // Register the settings row once the `settings.general.item` slot is on the
    // ledger. slots.inject is the runtime's declaration-aware wait: the callback
    // runs when the declaration exists (or inside the declaring register call),
    // and collapses dispose it so a re-declaration re-runs it.
    ctx.slots.inject('settings.general.item', () => ctx.slots.register({
        name: 'settings.general.item',
        id: 'web-ui-notify',
        order: 30,
        locale: NS,
    }, NotificationSettingsRow));
}
