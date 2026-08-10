/**
 * Pure notification helpers: visibility check, permission gate, and the
 * Notification construction for one pending wait, one completed turn, or one
 * background-session event. Kept side-effect-free (beyond constructing
 * Notification) so the browser-plugin spec can drive them with a stub
 * Notification and a fake visibilityState.
 */
import type { PendingInteraction } from '@deepseek-ai/dsh-client-runtime/client'
import type { NotifyKey } from './locales.ts'

/** Locale translate function shape (the bound `t` from ctx.locale). */
export type Translate = (key: NotifyKey, params?: Record<string, string>) => string

/** What clicking a notification does: focus the window, then jump to the source conversation. */
export type OpenHandler = () => void

/**
 * Session-target bundle every notification carries: the session's display
 * label (for the title) and the click-to-jump handler (which opens that
 * conversation in the web UI).
 */
export interface NotifyTarget {
  /** Session display label appended to the title, e.g. "重构数据库 · 需要审批". */
  label: string
  /** Click-to-jump handler (open the source conversation). */
  onOpen: OpenHandler
}

/**
 * Whether the page is currently hidden (the user is on another tab).
 * @returns true when the document visibility state is 'hidden'.
 */
export function hiddenNow(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

/**
 * Whether the browser supports the Notification API and has granted permission.
 * @returns true when `new Notification` may be constructed.
 */
export function notificationUsable(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/**
 * Attach the click-to-jump behavior shared by every notification this plugin
 * builds: raise the window, jump to the source conversation, and dismiss.
 */
function withClickFocus(notification: Notification, onOpen: OpenHandler): Notification {
  notification.onclick = () => {
    window.focus()
    onOpen()
    notification.close()
  }
  return notification
}

/** Compose a notification title: the session label first, then the kind title. */
function titled(kindTitle: string, label: string): string {
  return label === '' ? kindTitle : `${label} · ${kindTitle}`
}

/** The one rendering path every notification kind funnels through. */
function show(title: string, body: string, tag: string, target: NotifyTarget): Notification {
  return withClickFocus(new Notification(title, { body, tag, requireInteraction: true }), target.onOpen)
}

/**
 * Build and show the desktop notification for one pending wait. The caller
 * gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * wait key; this function only renders.
 * @param wait - the pending approval or question interaction.
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler.
 * @returns the constructed Notification (tests assert on it).
 */
export function fireNotification(wait: PendingInteraction, t: Translate, target: NotifyTarget): Notification {
  const title = titled(
    wait.kind === 'approval' ? t('notify.approval.title') : t('notify.question.title'),
    target.label,
  )
  const body = wait.kind === 'approval'
    ? (wait.payload.reason ?? t('notify.approval.body', { toolName: wait.payload.toolName }))
    : (() => {
      const first = wait.payload.questions[0]
      return first?.question !== undefined && first.question !== ''
        ? first.question
        : t('notify.question.bodyGeneric')
    })()
  return show(title, body, wait.key, target)
}

/**
 * Build and show the desktop notification for a completed turn. The caller
 * gates on {@link hiddenNow} / {@link notificationUsable} and dedupes by
 * turn; this function only renders.
 * @param turn - the completed turn number.
 * @param summary - optional excerpt of the turn's final assistant text; when
 *   absent (a tool-only turn) the notification falls back to the turn number.
 * @param t - bound locale translate for the plugin namespace.
 * @param target - session label + click-to-jump handler.
 * @returns the constructed Notification (tests assert on it).
 */
export function fireTurnNotification(
  turn: number,
  summary: string | undefined,
  t: Translate,
  target: NotifyTarget,
): Notification {
  const body = summary !== undefined && summary !== ''
    ? summary
    : t('notify.turn.body', { turn: String(turn) })
  return show(titled(t('notify.turn.title'), target.label), body, `turn:${turn}`, target)
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
export function fireSessionDoneNotification(
  t: Translate,
  target: NotifyTarget & { tag: string },
): Notification {
  return show(titled(t('notify.sessionDone.title'), target.label), t('notify.other.done.body'), target.tag, target)
}
