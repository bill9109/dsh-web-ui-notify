import { NotificationSettingsRow } from "./NotificationSettingsRow.js";
import { en, NS, zh } from "./locales.js";
import { fireNotification, fireSessionDoneNotification, fireTurnNotification, hiddenNow, notificationUsable, } from "./notify.js";
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
 * to the session list (background waits + completions) and the current
 * session's snapshot (turn completions), and register the settings row.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notify: dictionaries');
    const t = ctx.locale.bind(NS);
    const sessions = ctx.sessions;
    /**
     * PendingWait keys already notified, scoped by session (`${sid}:${wait.key}`,
     * stable across replay, so reconnect and mux-open replay stay silent).
     */
    const notified = new Set();
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
    /** Scan the current session's snapshot; notify newly finished turns. */
    const scan = () => {
        const current = sessions.list.getSnapshot().current;
        if (current === undefined)
            return;
        const session = sessions.binding(current)?.session;
        if (session === undefined)
            return;
        const snapshot = session.getSnapshot();
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
     * Scan the session list: notify pending waits (current AND background, from
     * the session's snapshot payload, deduped by stable wait key) and whole-
     * session completion (background only, once per finish).
     */
    const scanList = () => {
        const list = sessions.list.getSnapshot();
        const current = list.current;
        for (const sid of list.ids) {
            const summary = list.byId[sid];
            if (summary === undefined)
                continue;
            // The status is just the "this session has a wait" trigger; the wait
            // itself (and its payload) comes from the session snapshot.
            if (summary.pendingInteraction !== undefined) {
                const session = sessions.binding(sid)?.session;
                if (session !== undefined) {
                    for (const wait of session.getSnapshot().pending) {
                        const key = `${sid}:${wait.key}`;
                        if (notified.has(key))
                            continue;
                        notified.add(key);
                        if (hiddenNow() && notificationUsable()) {
                            fireNotification(wait, t, { label: labelOf(sid), onOpen: openOf(sid) });
                        }
                    }
                }
            }
            // Whole-session completion ("done" reminder): notify once per session,
            // cleared when the flag drops (running again / opened / removed).
            if (sid !== current && summary.completed === true) {
                if (!completedNotified.has(sid)) {
                    completedNotified.add(sid);
                    if (hiddenNow() && notificationUsable()) {
                        fireSessionDoneNotification(t, {
                            label: labelOf(sid), onOpen: openOf(sid), tag: `${sid}:done`,
                        });
                    }
                }
            }
            else if (summary.completed !== true) {
                completedNotified.delete(sid);
            }
        }
        // Drop completion state for sessions that left the list.
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
