/** Heartbeat period: peers older than the TTL are considered gone. */
const HEARTBEAT_MS = 4000;
/** A peer that missed this much is treated as closed (frozen tabs included). */
const PEER_TTL_MS = 12000;
/** How long a non-winner waits for the winner's "shown" broadcast. */
const FALLBACK_MS = 600;
/** Persisted "shown" keys older than this are re-announced rather than lost. */
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
/** Persisted-memory key prefix, namespaced to this plugin. */
const MEMORY_PREFIX = 'dsh-web-ui-notify:shown:';
/** A random page id, falling back when `crypto.randomUUID` is unavailable. */
function randomPageId() {
    const cryptoRef = globalThis.crypto;
    return cryptoRef?.randomUUID?.() ?? `page-${Math.random().toString(36).slice(2)}`;
}
/** The browser default bus: a BroadcastChannel, or nothing when unsupported. */
function browserBus(name) {
    const Channel = globalThis.BroadcastChannel;
    if (Channel === undefined)
        return undefined;
    const channel = new Channel(name);
    return {
        postMessage: (message) => { channel.postMessage(message); },
        onMessage: (handler) => { channel.onmessage = event => handler(event.data); },
        close: () => { channel.close(); },
    };
}
/** The browser default memory: localStorage, or nothing when unsupported. */
function browserMemory() {
    try {
        const storage = globalThis.localStorage;
        if (storage === undefined)
            return undefined;
        return { read: key => storage.getItem(key), write: (key, value) => { storage.setItem(key, value); } };
    }
    catch {
        // Storage can throw when the browser blocks it; coordination then stays in-page.
        return undefined;
    }
}
/** The bus name all pages of one origin share. */
export const PAGE_BUS_NAME = 'dsh-web-ui-notify/pages';
/**
 * Create one page's coordinator.
 * @param options - injectable seams; production passes nothing.
 * @returns the coordinator for this page.
 */
export function createPageCoordination(options = {}) {
    const pageId = options.pageId ?? randomPageId();
    const bus = options.bus ?? browserBus(PAGE_BUS_NAME);
    const memory = options.memory ?? browserMemory();
    const now = options.now ?? (() => Date.now());
    const peers = new Map();
    const shown = new Set();
    const fallbacks = new Map();
    let view = { visible: true, sessionId: undefined, granted: false };
    const publish = () => {
        bus?.postMessage({ kind: 'view', id: pageId, at: now(), ...view });
    };
    const markShown = (key) => {
        shown.add(key);
        memory?.write(`${MEMORY_PREFIX}${key}`, JSON.stringify({ at: now() }));
        bus?.postMessage({ kind: 'shown', id: pageId, key, at: now() });
    };
    const shownBefore = (key) => {
        if (shown.has(key))
            return true;
        const raw = memory?.read(`${MEMORY_PREFIX}${key}`);
        if (raw === null || raw === undefined)
            return false;
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed.at === 'number' && now() - parsed.at < MEMORY_TTL_MS;
        }
        catch {
            return false;
        }
    };
    const live = () => {
        const cutoff = now() - PEER_TTL_MS;
        for (const [id, peer] of peers)
            if (peer.at < cutoff)
                peers.delete(id);
        return [...peers.values()];
    };
    const cancelFallback = (key) => {
        fallbacks.get(key)?.();
        fallbacks.delete(key);
    };
    bus?.onMessage((data) => {
        if (typeof data !== 'object' || data === null)
            return;
        const message = data;
        if (message.id === undefined || message.id === pageId)
            return;
        switch (message.kind) {
            case 'view':
                peers.set(message.id, {
                    id: message.id,
                    at: message.at ?? now(),
                    visible: message.visible === true,
                    sessionId: message.sessionId,
                    granted: message.granted === true,
                });
                break;
            case 'shown':
                if (message.key !== undefined) {
                    shown.add(message.key);
                    cancelFallback(message.key);
                }
                break;
            case 'bye':
                peers.delete(message.id);
                break;
            default:
                break;
        }
    });
    const heartbeat = setInterval(publish, HEARTBEAT_MS);
    heartbeat.unref?.();
    return {
        pageId,
        announce: (next) => { view = next; publish(); },
        watched: (sessionId) => {
            if (view.visible && view.sessionId === sessionId)
                return true;
            return live().some(peer => peer.visible && peer.sessionId === sessionId);
        },
        elect: (key, sessionId, scope, fire) => {
            if (shownBefore(key))
                return false;
            // Someone is looking at that session: the information is already on screen.
            if (view.visible && view.sessionId === sessionId)
                return false;
            if (live().some(peer => peer.visible && peer.sessionId === sessionId))
                return false;
            const pool = [selfState(), ...live()]
                .filter(candidate => candidate.granted)
                .filter(candidate => scope === 'any-page' || candidate.sessionId === sessionId)
                // Visible pages first (the user is at the browser), then the lowest id.
                .sort((left, right) => Number(right.visible) - Number(left.visible) || (left.id < right.id ? -1 : 1));
            const winner = pool[0];
            if (winner === undefined)
                return false;
            if (winner.id === pageId) {
                markShown(key);
                fire();
                return true;
            }
            // The winner may be frozen: take over when its "shown" never arrives.
            const timer = setTimeout(() => {
                fallbacks.delete(key);
                if (shown.has(key))
                    return;
                markShown(key);
                fire();
            }, FALLBACK_MS);
            timer.unref?.();
            fallbacks.set(key, () => { clearTimeout(timer); });
            return false;
        },
        forget: (key) => {
            shown.delete(key);
            // An unparsable record counts as absent, so an empty write clears it.
            memory?.write(`${MEMORY_PREFIX}${key}`, '');
        },
        close: () => {
            clearInterval(heartbeat);
            bus?.postMessage({ kind: 'bye', id: pageId, at: now() });
            for (const cancel of fallbacks.values())
                cancel();
            fallbacks.clear();
            bus?.close();
        },
    };
    /** This page as an election candidate. */
    function selfState() {
        return { id: pageId, at: now(), ...view };
    }
}
