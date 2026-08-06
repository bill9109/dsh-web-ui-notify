import { deferRegistration } from '@deepseek-ai/dsh-client-ui-slots';
import { NotificationSettingsRow } from "./NotificationSettingsRow.js";
import { en, NS, zh } from "./locales.js";
import { fireNotification, fireTurnNotification, hiddenNow, notificationUsable } from "./notify.js";
/** Notification-body excerpt cap: keep the system notification compact. */
const SUMMARY_MAX = 80;
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
 * to the current session's pending waits and turn completions, and register
 * the settings row.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notify: dictionaries');
    const t = ctx.locale.bind(NS);
    const sessions = ctx.sessions;
    /** PendingWait keys already notified (stable across replay). */
    const notified = new Set();
    /** Completed turn numbers already seen per session (baseline absorbed on first scan). */
    const seenTurns = new Map();
    let unsubSession;
    let watched;
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
            // PendingInteraction is exactly { approval, question } — fireNotification
            // branches on kind, so no further filter is needed here.
            if (notified.has(wait.key))
                continue;
            notified.add(wait.key);
            if (hiddenNow() && notificationUsable()) {
                fireNotification(wait, t);
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
                fireTurnNotification(turn, turnSummaryOf(snapshot.nodes, turn), t);
            }
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
    const unsubList = sessions.list.subscribe(watchCurrent);
    watchCurrent();
    ctx.effect(() => () => {
        unsubList();
        unsubSession?.();
    }, 'ui-notify: session subscription');
    ctx.effect(() => {
        const row = deferRegistration(ctx.slots, 'settings.general.item', NotificationSettingsRow, () => ctx.slots.register({
            name: 'settings.general.item',
            id: 'web-ui-notify',
            order: 30,
            locale: NS,
        }, NotificationSettingsRow));
        return () => { row.dispose(); };
    }, 'ui-notify: settings row registration');
}
