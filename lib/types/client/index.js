import { NotificationSettingsRow } from "./NotificationSettingsRow.js";
import { en, NS, zh } from "./locales.js";
import { fireNotification, fireSessionNotification, fireTurnNotification, hiddenNow, notificationUsable, } from "./notify.js";
/** Notification-body excerpt cap: keep the system notification compact. */
const SUMMARY_MAX = 80;
/** Session-label cap in notification titles: keep the title bar compact. */
const SESSION_LABEL_MAX = 40;
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
/** Required services: the settings slots registry, session domain, and locale. */
export const inject = ['slots', 'sessions', 'locale'];
/**
 * Client plugin body: register the `web-ui-notify` dictionaries, subscribe
 * to the session list (background events) and the current session's snapshot
 * (rich events), and register the settings row.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notify: dictionaries');
    const t = ctx.locale.bind(NS);
    const sessions = ctx.sessions;
    /** Snapshot-layer PendingWait keys already notified, scoped by session (`${sid}:${key}`, stable across replay). */
    const notified = new Set();
    /**
     * Cross-layer guard: pending kinds already notified via the list layer for a
     * background session. The snapshot layer consumes one entry when it
     * re-presents the wait (after the session becomes current) and stays silent;
     * the list layer clears entries once the status is gone.
     */
    const listNotified = new Map();
    /** Whole-session completions already notified via the list layer. */
    const completedNotified = new Set();
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
        // The session may have left the list while the notification lingered;
        // open() throws on unknown ids, so only open still-listed sessions.
        if (sessions.list.getSnapshot().byId[sid] !== undefined)
            sessions.open(sid);
    };
    /** Scan the current session's snapshot; notify new waits and newly finished turns. */
    const scan = () => {
        const current = sessions.list.getSnapshot().current;
        if (current === undefined)
            return;
        const session = sessions.binding(current)?.session;
        if (session === undefined)
            return;
        const snapshot = session.getSnapshot();
        for (const wait of snapshot.pending) {
            const key = `${current}:${wait.key}`;
            if (notified.has(key))
                continue;
            notified.add(key);
            // A list-layer notification may already have covered this wait while the
            // session was background: consume the guard so the generic body the user
            // saw is not followed by a duplicate rich one. A later NEW wait of the
            // same kind notifies normally.
            const guard = listNotified.get(current);
            if (guard?.delete(wait.kind) === true) {
                if (guard.size === 0)
                    listNotified.delete(current);
                continue;
            }
            if (hiddenNow() && notificationUsable()) {
                fireNotification(wait, t, { label: labelOf(current), onOpen: openOf(current) });
            }
        }
        // Turn completion: only track once the window is OPEN (history loaded);
        // the first open scan absorbs the turns already finished, so a session's
        // past is never re-notified, and later scans notify only for new numbers.
        // Replay re-presents the same numbers, so it stays silent too.
        if (snapshot.openState !== 'open')
            return;
        let turns = seenTurns.get(current);
        if (turns === undefined) {
            turns = new Set(snapshot.turnEnds.keys());
            seenTurns.set(current, turns);
            return;
        }
        for (const turn of snapshot.turnEnds.keys()) {
            if (turns.has(turn))
                continue;
            turns.add(turn);
            if (hiddenNow() && notificationUsable()) {
                fireTurnNotification(turn, turnSummaryOf(snapshot.nodes, turn), t, {
                    label: labelOf(current), onOpen: openOf(current),
                });
            }
        }
    };
    /**
     * Scan the session list for BACKGROUND sessions: pending interactions
     * (status-level, generic body) and whole-session completion. The current
     * session is skipped here — the snapshot layer owns it with the rich body.
     */
    const scanList = () => {
        const list = sessions.list.getSnapshot();
        const current = list.current;
        for (const sid of list.ids) {
            const summary = list.byId[sid];
            if (summary === undefined)
                continue;
            const status = summary.pendingInteraction;
            if (sid !== current && status !== undefined) {
                // plan-review is a binary approve/reject question; report it as a question.
                const kind = status === 'approval' ? 'approval' : 'question';
                const guard = listNotified.get(sid);
                if (guard === undefined || !guard.has(kind)) {
                    if (guard === undefined)
                        listNotified.set(sid, new Set([kind]));
                    else
                        guard.add(kind);
                    if (hiddenNow() && notificationUsable()) {
                        fireSessionNotification(kind, t, {
                            label: labelOf(sid), onOpen: openOf(sid), tag: `${sid}:${kind}`,
                        });
                    }
                }
            }
            else if (status === undefined) {
                // The wait is gone — a later same-kind wait may notify again.
                listNotified.delete(sid);
            }
            // Whole-session completion ("done" reminder): notify once per session,
            // cleared when the flag drops (running again / opened / removed).
            if (sid !== current && summary.completed === true) {
                if (!completedNotified.has(sid)) {
                    completedNotified.add(sid);
                    if (hiddenNow() && notificationUsable()) {
                        fireSessionNotification('done', t, {
                            label: labelOf(sid), onOpen: openOf(sid), tag: `${sid}:done`,
                        });
                    }
                }
            }
            else if (summary.completed !== true) {
                completedNotified.delete(sid);
            }
        }
        // Drop guard state for sessions that left the list.
        for (const sid of listNotified.keys()) {
            if (list.byId[sid] === undefined)
                listNotified.delete(sid);
        }
        for (const sid of completedNotified) {
            if (list.byId[sid] === undefined)
                completedNotified.delete(sid);
        }
    };
    /** Re-subscribe to the current session's snapshot when `current` moves. */
    const watchCurrent = () => {
        const current = sessions.list.getSnapshot().current;
        if (current === watched)
            return;
        unsubSession?.();
        unsubSession = undefined;
        watched = current;
        if (current === undefined)
            return;
        const session = sessions.binding(current)?.session;
        if (session === undefined)
            return;
        unsubSession = session.subscribe(scan);
        scan();
    };
    const unsubList = sessions.list.subscribe(() => { watchCurrent(); scanList(); });
    watchCurrent();
    scanList();
    ctx.effect(() => () => {
        unsubList();
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
