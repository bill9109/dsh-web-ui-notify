/**
 * Cross-page coordination for desktop notifications.
 *
 * Every browser tab runs its own copy of this plugin, so a naive build shows
 * one notification PER TAB. This module makes the tabs agree:
 *
 * - Each page announces its view (tab visibility, the session its main view
 *   shows, and whether `new Notification` works) on change, on a heartbeat, and
 *   on goodbye.
 * - An event belongs to ONE session. If any live page is visibly showing that
 *   session, the user is already looking at it and nobody announces anything.
 * - Otherwise exactly one page shows the notification. Preference goes to a
 *   visible page (the user is at the browser), then to the lowest page id, so
 *   every page computes the same winner without a negotiation round.
 * - A winner can still be frozen (discarded/frozen background tab, where its JS
 *   never runs). The other candidates therefore wait briefly for the winner's
 *   "shown" broadcast and take over when it never arrives.
 * - Keys already shown are remembered across pages AND across reloads, so a
 *   refresh never re-announces a wait that is still pending.
 *
 * Everything is injectable (bus, memory, clock, page id) because the whole
 * point of this module is behaviour that only shows up with several pages.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** What one page announces about itself to its sibling pages. */
export interface PageView {
    /** Whether this tab is visible to the user right now. */
    readonly visible: boolean;
    /** The session this page's main view shows, when it shows one. */
    readonly sessionId: SessionId | undefined;
    /** Whether desktop notifications are permitted in this page. */
    readonly granted: boolean;
}
/** The slice of BroadcastChannel this coordinator needs (injectable for tests). */
export interface PageBus {
    /** Broadcast one message to every other page of the same origin. */
    postMessage(message: unknown): void;
    /** Receive messages from other pages. */
    onMessage(handler: (data: unknown) => void): void;
    /** Release the underlying channel. */
    close(): void;
}
/** Durable cross-page memory for keys that were already shown. */
export interface PageMemory {
    /** Read one persisted value, or null when absent. */
    read(key: string): string | null;
    /** Persist one value (same origin, survives a reload). */
    write(key: string, value: string): void;
}
/** Which pages may take part in one election. */
export type ElectScope = 
/** Every page that sees the event and is allowed to notify. */
'any-page'
/** Only pages whose main view shows that session (turn events). */
 | 'showing-session';
/** Optional seams; production uses the browser globals. */
export interface PageCoordinationOptions {
    /** This page's identity; defaults to a random id. */
    readonly pageId?: string | undefined;
    /** Cross-page bus; defaults to a BroadcastChannel when the browser has one. */
    readonly bus?: PageBus | undefined;
    /** Durable memory; defaults to localStorage when the browser has one. */
    readonly memory?: PageMemory | undefined;
    /** Clock, injectable so tests can drive heartbeats and deadlines. */
    readonly now?: (() => number) | undefined;
}
/** Public surface of one page's coordinator. */
export interface PageCoordination {
    /** This page's stable id (election tie-break and diagnostics). */
    readonly pageId: string;
    /** Publish this page's view now (also refreshes the heartbeat payload). */
    announce(view: PageView): void;
    /** Whether some live page is visibly showing `sessionId` right now. */
    watched(sessionId: SessionId): boolean;
    /**
     * Show `key` exactly once across pages.
     * @param key - event identity, also the notification tag.
     * @param sessionId - session the event belongs to.
     * @param scope - which pages may take part.
     * @param fire - renders the notification; runs on the elected page only.
     * @returns true when this call showed it immediately.
     */
    elect(key: string, sessionId: SessionId, scope: ElectScope, fire: () => void): boolean;
    /**
     * Drop a key's "already shown" state so the same identity may notify again.
     * Recurring identities (a session's completion reminder) re-arm through this
     * when their flag drops; one-shot identities (a wait key, a turn number)
     * never need it.
     * @param key - the key passed to {@link elect}.
     */
    forget(key: string): void;
    /** Stop heartbeating and drop the bus. */
    close(): void;
}
/** The bus name all pages of one origin share. */
export declare const PAGE_BUS_NAME = "dsh-web-ui-notify/pages";
/**
 * Create one page's coordinator.
 * @param options - injectable seams; production passes nothing.
 * @returns the coordinator for this page.
 */
export declare function createPageCoordination(options?: PageCoordinationOptions): PageCoordination;
