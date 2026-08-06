/**
 * Approval-notification plugin, browser half: when an approval or question
 * wait lands on the current session, or a turn finishes, while the page is
 * hidden (the user is on another tab), show a desktop Notification. A
 * General-settings row exposes the permission request button — the
 * user-gesture entry point the browser requires before `new Notification`
 * works.
 *
 * Observation model: the composer chain is where approval/question waits
 * "pop up" in the UI, and it serves the CURRENT session only. Subscribing to
 * the current session's conversation snapshot therefore matches the pop-up
 * semantics exactly — non-current sessions' waits surface only once opened
 * (their buffered frames replay), which is also when a notification is
 * meaningful. Dedupe keys are the PendingWait keys (`a:<rpcId>`/`q:<rpcId>`),
 * stable across mux-open replay by construction. Turn completion is read off
 * the snapshot's `turnEnds` map: the first scan of a session absorbs the
 * current map as baseline (no history spam), later scans notify only for
 * turn numbers not seen before — replay re-presents the same numbers, so it
 * stays silent.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ISessions, ConversationNode } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { NotificationSettingsRow } from './NotificationSettingsRow.tsx'
import { en, NS, zh, type NotifyKey } from './locales.ts'
import { fireNotification, fireTurnNotification, hiddenNow, notificationUsable } from './notify.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The web-ui-notify surfaces' copy (settings row + notification titles). */
    'web-ui-notify': NotifyKey
  }
}

/** Notification-body excerpt cap: keep the system notification compact. */
const SUMMARY_MAX = 80

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

/** Required services: the settings slots registry, session domain, and locale. */
export const inject = ['slots', 'sessions', 'locale']

/**
 * Client plugin body: register the `web-ui-notify` dictionaries, subscribe
 * to the current session's pending waits and turn completions, and register
 * the settings row.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notify: dictionaries')
  const t = ctx.locale.bind(NS)
  const sessions: ISessions = ctx.sessions

  /** PendingWait keys already notified (stable across replay). */
  const notified = new Set<string>()
  /** Completed turn numbers already seen per session (baseline absorbed on first scan). */
  const seenTurns = new Map<SessionId, Set<number>>()
  let unsubSession: (() => void) | undefined
  let watched: SessionId | undefined

  /** Scan the current session's snapshot; notify new waits and newly finished turns. */
  const scan = (): void => {
    const current = sessions.list.getSnapshot().current
    if (current === undefined) return
    const session = sessions.binding(current)?.session
    if (session === undefined) return
    const snapshot = session.getSnapshot()
    for (const wait of snapshot.pending) {
      // PendingInteraction is exactly { approval, question } — fireNotification
      // branches on kind, so no further filter is needed here.
      if (notified.has(wait.key)) continue
      notified.add(wait.key)
      if (hiddenNow() && notificationUsable()) {
        fireNotification(wait, t)
      }
    }
    // Turn completion: only track once the window is OPEN (history loaded);
    // the first open scan absorbs the turns already finished, so a session's
    // past is never re-notified, and later scans notify only for new numbers.
    // Replay re-presents the same numbers, so it stays silent too.
    if (snapshot.openState !== 'open') return
    let turns = seenTurns.get(current)
    if (turns === undefined) {
      turns = new Set(snapshot.turnEnds.keys())
      seenTurns.set(current, turns)
      return
    }
    for (const turn of snapshot.turnEnds.keys()) {
      if (turns.has(turn)) continue
      turns.add(turn)
      if (hiddenNow() && notificationUsable()) {
        fireTurnNotification(turn, turnSummaryOf(snapshot.nodes, turn), t)
      }
    }
  }

  /** Re-subscribe to the current session's snapshot when `current` moves. */
  const watchCurrent = (): void => {
    const current = sessions.list.getSnapshot().current
    if (current === watched) return
    unsubSession?.()
    unsubSession = undefined
    watched = current
    if (current === undefined) return
    const session = sessions.binding(current)?.session
    if (session === undefined) return
    unsubSession = session.subscribe(scan)
    scan()
  }

  const unsubList = sessions.list.subscribe(watchCurrent)
  watchCurrent()
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
