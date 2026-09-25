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
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** What one page announces about itself to its sibling pages. */
export interface PageView {
  /** Whether this tab is visible to the user right now. */
  readonly visible: boolean
  /** The session this page's main view shows, when it shows one. */
  readonly sessionId: SessionId | undefined
  /** Whether desktop notifications are permitted in this page. */
  readonly granted: boolean
}

/** The slice of BroadcastChannel this coordinator needs (injectable for tests). */
export interface PageBus {
  /** Broadcast one message to every other page of the same origin. */
  postMessage(message: unknown): void
  /** Receive messages from other pages. */
  onMessage(handler: (data: unknown) => void): void
  /** Release the underlying channel. */
  close(): void
}

/** Durable cross-page memory for keys that were already shown. */
export interface PageMemory {
  /** Read one persisted value, or null when absent. */
  read(key: string): string | null
  /** Persist one value (same origin, survives a reload). */
  write(key: string, value: string): void
}

/** Which pages may take part in one election. */
export type ElectScope =
  /** Every page that sees the event and is allowed to notify. */
  | 'any-page'
  /** Only pages whose main view shows that session (turn events). */
  | 'showing-session'

/** Optional seams; production uses the browser globals. */
export interface PageCoordinationOptions {
  /** This page's identity; defaults to a random id. */
  readonly pageId?: string | undefined
  /** Cross-page bus; defaults to a BroadcastChannel when the browser has one. */
  readonly bus?: PageBus | undefined
  /** Durable memory; defaults to localStorage when the browser has one. */
  readonly memory?: PageMemory | undefined
  /** Clock, injectable so tests can drive heartbeats and deadlines. */
  readonly now?: (() => number) | undefined
}

/** Public surface of one page's coordinator. */
export interface PageCoordination {
  /** This page's stable id (election tie-break and diagnostics). */
  readonly pageId: string
  /** Publish this page's view now (also refreshes the heartbeat payload). */
  announce(view: PageView): void
  /** Whether some live page is visibly showing `sessionId` right now. */
  watched(sessionId: SessionId): boolean
  /**
   * Show `key` exactly once across pages.
   * @param key - event identity, also the notification tag.
   * @param sessionId - session the event belongs to.
   * @param scope - which pages may take part.
   * @param fire - renders the notification; runs on the elected page only.
   * @returns true when this call showed it immediately.
   */
  elect(key: string, sessionId: SessionId, scope: ElectScope, fire: () => void): boolean
  /**
   * Drop a key's "already shown" state so the same identity may notify again.
   * Recurring identities (a session's completion reminder) re-arm through this
   * when their flag drops; one-shot identities (a wait key, a turn number)
   * never need it.
   * @param key - the key passed to {@link elect}.
   */
  forget(key: string): void
  /** Stop heartbeating and drop the bus. */
  close(): void
}

/** Heartbeat period: peers older than the TTL are considered gone. */
const HEARTBEAT_MS = 4000
/** A peer that missed this much is treated as closed (frozen tabs included). */
const PEER_TTL_MS = 12000
/** How long a non-winner waits for the winner's "shown" broadcast. */
const FALLBACK_MS = 600
/** Persisted "shown" keys older than this are re-announced rather than lost. */
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000
/** Persisted-memory key prefix, namespaced to this plugin. */
const MEMORY_PREFIX = 'dsh-web-ui-notify:shown:'

interface PageState extends PageView {
  readonly id: string
  readonly at: number
}

/** A random page id, falling back when `crypto.randomUUID` is unavailable. */
function randomPageId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return cryptoRef?.randomUUID?.() ?? `page-${Math.random().toString(36).slice(2)}`
}

/** The browser default bus: a BroadcastChannel, or nothing when unsupported. */
function browserBus(name: string): PageBus | undefined {
  const Channel = (globalThis as { BroadcastChannel?: new (name: string) => BroadcastChannel }).BroadcastChannel
  if (Channel === undefined) return undefined
  const channel = new Channel(name)
  return {
    postMessage: (message) => { channel.postMessage(message) },
    onMessage: (handler) => { channel.onmessage = event => handler(event.data) },
    close: () => { channel.close() },
  }
}

/** The browser default memory: localStorage, or nothing when unsupported. */
function browserMemory(): PageMemory | undefined {
  try {
    const storage = globalThis.localStorage
    if (storage === undefined) return undefined
    return { read: key => storage.getItem(key), write: (key, value) => { storage.setItem(key, value) } }
  } catch {
    // Storage can throw when the browser blocks it; coordination then stays in-page.
    return undefined
  }
}

/** The bus name all pages of one origin share. */
export const PAGE_BUS_NAME = 'dsh-web-ui-notify/pages'

/**
 * Create one page's coordinator.
 * @param options - injectable seams; production passes nothing.
 * @returns the coordinator for this page.
 */
export function createPageCoordination(options: PageCoordinationOptions = {}): PageCoordination {
  const pageId = options.pageId ?? randomPageId()
  const bus = options.bus ?? browserBus(PAGE_BUS_NAME)
  const memory = options.memory ?? browserMemory()
  const now = options.now ?? (() => Date.now())

  const peers = new Map<string, PageState>()
  const shown = new Set<string>()
  const fallbacks = new Map<string, () => void>()
  let view: PageView = { visible: true, sessionId: undefined, granted: false }

  const publish = (): void => {
    bus?.postMessage({ kind: 'view', id: pageId, at: now(), ...view })
  }

  const markShown = (key: string): void => {
    shown.add(key)
    memory?.write(`${MEMORY_PREFIX}${key}`, JSON.stringify({ at: now() }))
    bus?.postMessage({ kind: 'shown', id: pageId, key, at: now() })
  }

  const shownBefore = (key: string): boolean => {
    if (shown.has(key)) return true
    const raw = memory?.read(`${MEMORY_PREFIX}${key}`)
    if (raw === null || raw === undefined) return false
    try {
      const parsed = JSON.parse(raw) as { at?: number }
      return typeof parsed.at === 'number' && now() - parsed.at < MEMORY_TTL_MS
    } catch {
      return false
    }
  }

  const live = (): PageState[] => {
    const cutoff = now() - PEER_TTL_MS
    for (const [id, peer] of peers) if (peer.at < cutoff) peers.delete(id)
    return [...peers.values()]
  }

  const cancelFallback = (key: string): void => {
    fallbacks.get(key)?.()
    fallbacks.delete(key)
  }

  bus?.onMessage((data) => {
    if (typeof data !== 'object' || data === null) return
    const message = data as { kind?: string; id?: string; key?: string; at?: number } & Partial<PageView>
    if (message.id === undefined || message.id === pageId) return
    switch (message.kind) {
      case 'view':
        peers.set(message.id, {
          id: message.id,
          at: message.at ?? now(),
          visible: message.visible === true,
          sessionId: message.sessionId,
          granted: message.granted === true,
        })
        break
      case 'shown':
        if (message.key !== undefined) {
          shown.add(message.key)
          cancelFallback(message.key)
        }
        break
      case 'bye':
        peers.delete(message.id)
        break
      default:
        break
    }
  })

  const heartbeat = setInterval(publish, HEARTBEAT_MS)
  // A heartbeat must never keep a page (or a test run) alive on its own.
  ;(heartbeat as unknown as { unref?: () => void }).unref?.()

  return {
    pageId,
    announce: (next) => { view = next; publish() },
    watched: (sessionId) => {
      if (view.visible && view.sessionId === sessionId) return true
      return live().some(peer => peer.visible && peer.sessionId === sessionId)
    },
    elect: (key, sessionId, scope, fire) => {
      if (shownBefore(key)) return false
      // Someone is looking at that session: the information is already on screen.
      if (view.visible && view.sessionId === sessionId) return false
      if (live().some(peer => peer.visible && peer.sessionId === sessionId)) return false
      const pool = [selfState(), ...live()]
        .filter(candidate => candidate.granted)
        .filter(candidate => scope === 'any-page' || candidate.sessionId === sessionId)
        // Visible pages first (the user is at the browser), then the lowest id.
        .sort((left, right) => Number(right.visible) - Number(left.visible) || (left.id < right.id ? -1 : 1))
      const winner = pool[0]
      if (winner === undefined) return false
      if (winner.id === pageId) {
        markShown(key)
        fire()
        return true
      }
      // The winner may be frozen: take over when its "shown" never arrives.
      const timer = setTimeout(() => {
        fallbacks.delete(key)
        if (shown.has(key)) return
        markShown(key)
        fire()
      }, FALLBACK_MS)
      ;(timer as unknown as { unref?: () => void }).unref?.()
      fallbacks.set(key, () => { clearTimeout(timer) })
      return false
    },
    forget: (key) => {
      shown.delete(key)
      // An unparsable record counts as absent, so an empty write clears it.
      memory?.write(`${MEMORY_PREFIX}${key}`, '')
    },
    close: () => {
      clearInterval(heartbeat)
      bus?.postMessage({ kind: 'bye', id: pageId, at: now() })
      for (const cancel of fallbacks.values()) cancel()
      fallbacks.clear()
      bus?.close()
    },
  }

  /** This page as an election candidate. */
  function selfState(): PageState {
    return { id: pageId, at: now(), ...view }
  }
}
