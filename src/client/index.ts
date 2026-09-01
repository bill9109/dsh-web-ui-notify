/**
 * Approval-notification plugin, browser half: when an approval or question
 * wait lands, or a turn finishes, while the page is hidden (the user is on
 * another tab), show a desktop Notification. Titles name the source session,
 * and clicking a notification jumps to that exact conversation. A
 * General-settings row exposes the permission request button — the
 * user-gesture entry point the browser requires before `new Notification`
 * works.
 *
 * Observation model — two layers:
 *
 * 1. The LIST layer (all sessions) is the sidebar-dot signal: it reports, for
 *    every listed session, a pending-interaction status ('approval' /
 *    'plan-review' / 'question') and a whole-session completion flag. The
 *    status is only a TRIGGER: it says "this session has a wait", and the
 *    plugin then resolves the session binding (minting the scope lazily, same
 *    as opening would) to read the wait's full payload. This is what lets a
 *    BACKGROUND session (one you are not looking at) raise a notification —
 *    with its own title, the rich body (approval reason / question text), and
 *    a click that opens it.
 *
 * 2. The SNAPSHOT layer (the CURRENT session only) handles per-turn
 *    completion with the final-text excerpt. The `turnEnds` baseline absorbs a
 *    session's past on first open so history is never re-notified, and replay
 *    re-presents the same numbers so it stays silent.
 *
 * Dedupe is one set of PendingWait keys (`${sid}:${wait.key}`), shared by
 * current and background sessions. Wait keys are stable across mux-open
 * replay, so reconnect (which clears and re-adds the same still-pending
 * waits) never re-fires — the same "同一件事只通知一次，断线重连不会重复响"
 * guarantee the wait-key dedupe gave the current session now covers
 * background sessions too.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ISessions, ConversationNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionPendingInteraction } from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.general.item' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { NotificationSettingsRow } from './NotificationSettingsRow.tsx'
import { en, NS, zh, type NotifyKey } from './locales.ts'
import {
  fireNotification, fireSessionDoneNotification, fireTurnNotification, hiddenNow, notificationUsable,
} from './notify.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The web-ui-notify surfaces' copy (settings row + notification titles). */
    'web-ui-notify': NotifyKey
  }
}

/** Notification-body excerpt cap: keep the system notification compact. */
const SUMMARY_MAX = 80
/** Session-label cap in notification titles: keep the title bar compact. */
const SESSION_LABEL_MAX = 40

/**
 * Extract a compact excerpt of one turn's final assistant text for the
 * notification body: the LAST assistant node of that turn, text blocks joined
 * and truncated. A tool-only turn (no final text) yields undefined, so the
 * caller falls back to the turn-number copy.
 * @param nodes - the conversation nodes in event order.
 * @param turn - the finished turn number.
 * @returns the excerpt, or undefined when the turn produced no final text.
 */
export function turnSummaryOf(nodes: readonly ConversationNode[], turn: number): string | undefined {
  let text = ''
  for (const node of nodes) {
    if (node.kind !== 'assistant' || node.turn !== turn) continue
    let joined = ''
    for (const block of node.blocks) {
      if (block.kind === 'text') joined += block.text
    }
    if (joined !== '') text = joined
  }
  if (text === '') return undefined
  const trimmed = text.replace(/\s+/gu, ' ').trim()
  return trimmed.length > SUMMARY_MAX ? `${trimmed.slice(0, SUMMARY_MAX)}…` : trimmed
}

/** Required services: the settings slots registry, session domain, locale, and the
 * UI session/conversation adapters that carry the alpha2 pending-interaction and
 * chat snapshot sources. */
export const inject = ['slots', 'sessions', 'locale', 'uiConversation', 'uiSession']

/**
 * Client plugin body: register the `web-ui-notify` dictionaries, subscribe
 * to the session list (background waits + completions) and the current
 * session's snapshot (turn completions), and register the settings row.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notify: dictionaries')
  const t = ctx.locale.bind(NS)
  const sessions: ISessions = ctx.sessions

  /**
   * PendingWait keys already notified, scoped by session (`${sid}:${wait.key}`,
   * stable across replay, so reconnect and mux-open replay stay silent).
   */
  const notified = new Set<string>()
  /** Whole-session completions already notified via the list layer. */
  const completedNotified = new Set<SessionId>()
  /** Completed turn numbers already seen per session (baseline absorbed on first scan). */
  const seenTurns = new Map<SessionId, Set<number>>()
  let unsubSession: (() => void) | undefined
  let watched: SessionId | undefined

  /** Session display label for notification titles (fallback: the raw id). */
  const labelOf = (sid: SessionId): string => {
    const label = sessions.list.getSnapshot().byId[sid]?.displayTitle ?? sid
    return label.length > SESSION_LABEL_MAX ? `${label.slice(0, SESSION_LABEL_MAX)}…` : label
  }

  /** Click-to-jump handler for one notification: focus, then open its session. */
  const openOf = (sid: SessionId): () => void => () => {
    // The session may have left the list while the notification lingered;
    // open() throws on unknown ids, so only open still-listed sessions.
    if (sessions.list.getSnapshot().byId[sid] !== undefined) sessions.open(sid)
  }

  /** Scan the current session's chat snapshot; notify newly finished turns.
   *  alpha2 moved turnEnds/nodes off the session snapshot onto the Chat view's
   *  legacy projection, so this reads the chat target. A chat view that is not
   *  materialized yet yields undefined and is simply skipped.
   */
  const scan = (): void => {
    try {
      const current = sessions.list.getSnapshot().current
      if (current === undefined) return
      const snapshot = ctx.uiConversation.binding(current).target('chat').getSnapshot()
      if (snapshot === undefined || snapshot.legacy === undefined) return
      let turns = seenTurns.get(current)
      if (turns === undefined) {
        turns = new Set(snapshot.legacy.turnEnds.keys())
        seenTurns.set(current, turns)
        return
      }
      for (const turn of snapshot.legacy.turnEnds.keys()) {
        if (turns.has(turn)) continue
        turns.add(turn)
        if (hiddenNow() && notificationUsable()) {
          fireTurnNotification(turn, turnSummaryOf(snapshot.legacy.nodes, turn), t, {
            label: labelOf(current), onOpen: openOf(current),
          })
        }
      }
    } catch {
      // A notification scan must never surface as a subscriber error; the chat
      // source may be absent (non-chat view) or mid-restructure, so degrade.
    }
  }

  /**
   * Scan the UI pending-interaction source (approvals / questions, current AND
   * background, deduped by stable wait key) and the session list for whole-
   * session completion (background only, once per finish).
   */
  const scanList = (): void => {
    // alpha2: pending waits live on the uiSession.pendingInteractions source,
    // not on SessionSummary.pendingInteraction / SessionSnapshot.pending.
    try {
      const pending = ctx.uiSession.pendingInteractions.getSnapshot()
      for (const [sid, wait] of pending) {
        const key = `${sid}:${wait.key}`
        if (notified.has(key)) continue
        notified.add(key)
        if (hiddenNow() && notificationUsable()) {
          fireNotification(wait, t, { label: labelOf(sid), onOpen: openOf(sid) })
        }
      }
    } catch {
      // Pending-interaction source unavailable; skip waits, keep completions.
    }
    const list = sessions.list.getSnapshot()
    const current = list.current
    for (const sid of list.ids) {
      const summary = list.byId[sid]
      if (summary === undefined) continue
      // Whole-session completion ("done" reminder): notify once per session,
      // cleared when the flag drops (running again / opened / removed).
      if (sid !== current && summary.completed === true) {
        if (!completedNotified.has(sid)) {
          completedNotified.add(sid)
          if (hiddenNow() && notificationUsable()) {
            fireSessionDoneNotification(t, {
              label: labelOf(sid), onOpen: openOf(sid), tag: `${sid}:done`,
            })
          }
        }
      } else if (summary.completed !== true) {
        completedNotified.delete(sid)
      }
    }
    // Drop completion state for sessions that left the list.
    for (const sid of completedNotified) {
      if (list.byId[sid] === undefined) completedNotified.delete(sid)
    }
  }

  /** Re-subscribe to the current session's chat snapshot when `current` moves. */
  const watchCurrent = (): void => {
    const current = sessions.list.getSnapshot().current
    if (current === watched) return
    unsubSession?.()
    unsubSession = undefined
    watched = current
    if (current === undefined) return
    try {
      const chat = ctx.uiConversation.binding(current).target('chat')
      unsubSession = chat.subscribe(scan)
    } catch {
      unsubSession = undefined
    }
    scan()
  }

  const unsubList = sessions.list.subscribe(() => { watchCurrent(); scanList() })
  watchCurrent()
  scanList()
  ctx.effect(() => () => {
    unsubList()
    unsubSession?.()
  }, 'ui-notify: session subscription')

  // Register the settings row once the `settings.general.item` slot is on the
  // ledger. slots.inject is the runtime's declaration-aware wait: the callback
  // runs when the declaration exists (or inside the declaring register call),
  // and collapses dispose it so a re-declaration re-runs it.
  ctx.slots.inject('settings.general.item', () => ctx.slots.register(
    {
      name: 'settings.general.item',
      id: 'web-ui-notify',
      order: 30,
      locale: NS,
    },
    NotificationSettingsRow,
  ))
}
