/**
 * apply wiring on a real cordis Context + SlotRegistry + LocaleRuntime with
 * scripted sessions / uiSession / uiConversation faces: settings-row
 * registration through slot deferral, pending waits notified from ANY session
 * (current and background) with rich bodies, desktop-notification firing gated
 * on page visibility, click-to-jump, replay dedupe by stable wait key
 * (reconnect-safe), whole-session completion, plan-review rendering, degraded-
 * source diagnostics, and fiber-teardown cleanup.
 *
 * The scripted faces mirror the CURRENT client contract: pending waits and
 * background completions come from ctx.uiSession.sessionStatus (running /
 * pendingInteraction / completionUnread), turn completion from the current
 * session's Chat target (uiConversation.binding(id).target('chat').legacy), and
 * the session-list snapshot carries only rows + the current selection.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { NotificationSettingsRow } from '../src/client/NotificationSettingsRow.tsx'
import { apply, inject } from '../src/client/index.ts'

const SID = 's1' as SessionId

/** Stub notification: construct from options, record the instance, let the test fire onclick. */
class StubNotification {
  static readonly created: StubNotification[] = []
  static permission: NotificationPermission = 'granted'
  static requestPermission = vi.fn(async (): Promise<NotificationPermission> => 'granted')
  readonly title: string
  readonly options: NotificationOptions
  onclick: ((this: Notification, ev: Event) => unknown) | null = null
  closed = false
  constructor(title: string, options: NotificationOptions) {
    this.title = title
    this.options = options
    StubNotification.created.push(this)
  }
  close(): void { this.closed = true }
}

/** Drive document.visibilityState (the plugin's page-hidden gate). */
function pageHidden(hidden: boolean): void {
  Object.defineProperty(document, 'visibilityState', { value: hidden ? 'hidden' : 'visible', configurable: true })
}

/** HostObservable-shaped source (getSnapshot + subscribe) shared by every scripted face. */
function observable<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: (): T => value,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next: T): void {
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** One scripted list row: the fields the plugin reads off the list snapshot. */
interface ScriptedSummary {
  id: SessionId
  displayTitle: string
  retainedBy?: { mainView?: number }
}

/** Scripted sessions service face: the list store (rows only — rc.2 keeps no current). */
function scriptedSessions() {
  const listeners = new Set<() => void>()
  let summaries: Record<string, ScriptedSummary> = {
    [SID]: { id: SID, displayTitle: '主会话', retainedBy: { mainView: 1 } },
  }
  const fire = (): void => { for (const fn of [...listeners]) fn() }
  return {
    list: {
      subscribe(fn: () => void): () => void {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
      getSnapshot(): { ids: SessionId[]; byId: Record<string, ScriptedSummary> } {
        return { ids: Object.keys(summaries) as SessionId[], byId: summaries }
      },
    },
    /** Move the main view: rc.2 marks the shown session through retainedBy.mainView. */
    setCurrent(next: SessionId | undefined): void {
      for (const id of Object.keys(summaries)) {
        summaries[id] = { ...summaries[id]!, retainedBy: id === next ? { mainView: 1 } : {} }
      }
      fire()
    },
    setSummary(id: string, patch: Partial<ScriptedSummary>): void {
      summaries[id] = { ...(summaries[id] ?? { id: id as SessionId, displayTitle: id }), ...patch }
      fire()
    },
  }
}

/** One scripted `turn/end` reason, as the harness timeline carries it. */
interface ScriptedReason {
  kind: string
  error?: { message: string }
  reason?: { kind: string; reason?: string }
}

/** Scripted Chat target: what uiConversation.binding(id).target('chat') publishes. */
function scriptedChat() {
  const source = observable<{
    legacy: { nodes: readonly unknown[]; turnEnds: ReadonlyMap<number, number> }
    timeline: { turns: ReadonlyMap<number, { end: { seq: number; data: { reason: ScriptedReason } } }> }
  } | undefined>(undefined)
  let nodes: readonly unknown[] = []
  let turnEnds: ReadonlyMap<number, number> = new Map()
  let reasons: ReadonlyMap<number, ScriptedReason> = new Map()
  const publish = (): void => {
    source.set({
      legacy: { nodes, turnEnds },
      timeline: {
        turns: new Map([...turnEnds].map(([turn, seq]) => [
          turn,
          { end: { seq, data: { reason: reasons.get(turn) ?? { kind: 'completed' } } } },
        ])),
      },
    })
  }
  return {
    source,
    /** The window opens with history already present: the first scan absorbs it as baseline. */
    openWithHistory(next: ReadonlyMap<number, number>, nextNodes: readonly unknown[] = []): void {
      turnEnds = next
      nodes = nextNodes
      reasons = new Map()
      publish()
    },
    /** Publish turn ends; `nextReasons` defaults every turn to `completed`. */
    setTurnEnds(
      next: ReadonlyMap<number, number>,
      nextReasons: ReadonlyMap<number, ScriptedReason> = new Map(),
    ): void {
      turnEnds = next
      reasons = nextReasons
      publish()
    },
    setNodes(next: readonly unknown[]): void { nodes = next; publish() },
  }
}

/** One scripted status entry: the fields the plugin reads off sessionStatus. */
interface ScriptedStatus {
  running?: boolean
  pendingInteraction?: unknown
  completionUnread?: boolean
}

/** Scripted uiSession face: the unified per-session status source. */
function scriptedUiSession() {
  const sessionStatus = observable<ReadonlyMap<SessionId, ScriptedStatus>>(new Map())
  const patch = (sid: SessionId, next: ScriptedStatus): void => {
    const map = new Map(sessionStatus.getSnapshot())
    if (Object.keys(next).length === 0) map.delete(sid)
    else map.set(sid, next)
    sessionStatus.set(map)
  }
  const statusOf = (sid: SessionId): ScriptedStatus => sessionStatus.getSnapshot().get(sid) ?? {}
  return {
    sessionStatus,
    /** One wait per session is the contract (cross-domain precedence is ui-session's). */
    setWait(sid: SessionId, wait: unknown): void {
      patch(sid, { ...statusOf(sid), pendingInteraction: wait })
    },
    clearWait(sid: SessionId): void {
      const { pendingInteraction: _dropped, ...rest } = statusOf(sid)
      patch(sid, rest)
    },
    /** The "finished while you were elsewhere" flag dsh publishes per session. */
    setCompletionUnread(sid: SessionId, unread: boolean): void {
      patch(sid, { ...statusOf(sid), completionUnread: unread })
    },
  }
}

/** A uiSession whose status source is gone: the degraded-contract fixture. */
function brokenUiSession() {
  const listeners = new Set<() => void>()
  return {
    sessionStatus: {
      getSnapshot(): never { throw new Error('uiSession.sessionStatus is gone') },
      subscribe(listener: () => void): () => void {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    fire(): void { for (const listener of [...listeners]) listener() },
  }
}

/** Assemble a bench: real cordis ctx with slots/locale provided and the UI faces scripted. */
async function bench(options: { uiSession?: unknown } = {}) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  // The settings.general.item hole exists only while its declaring entry is live.
  slots.register(
    { name: 'root', children: { 'settings.general.item': { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  const sessions = scriptedSessions()
  ctx.provide('sessions', sessions as unknown as ISessions)
  const uiSession = options.uiSession ?? scriptedUiSession()
  ctx.provide('uiSession', uiSession as never)
  const openSession = vi.fn()
  ctx.provide('uiWorkspace', { openSession } as never)
  const chats = new Map<string, ReturnType<typeof scriptedChat>>()
  ctx.provide('uiConversation', {
    binding(id: SessionId) {
      return {
        target(name: string) {
          if (name !== 'chat') throw new Error(`unexpected target ${name}`)
          let chat = chats.get(id)
          if (chat === undefined) { chat = scriptedChat(); chats.set(id, chat) }
          return chat.source
        },
      }
    },
  } as never)
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  Object.assign(globalThis, { Notification: StubNotification })
  pageHidden(true)
  const chatOf = (id: string): ReturnType<typeof scriptedChat> => {
    let chat = chats.get(id)
    if (chat === undefined) { chat = scriptedChat(); chats.set(id, chat) }
    return chat
  }
  return {
    ctx,
    slots,
    sessions,
    workspace: { openSession },
    uiSession: uiSession as ReturnType<typeof scriptedUiSession>,
    chatOf,
    notify: StubNotification,
  }
}

/** One pending approval as the approval domain publishes it. */
function approvalWait(key: string, reason?: string) {
  return { kind: 'approval', key, toolName: 'bash', reason, sessionId: SID }
}

/** One pending question as the user-questions domain publishes it. */
function questionWait(key: string, question: string) {
  return { kind: 'question', key, questions: [{ id: key, question }], sessionId: SID }
}

/** One pending plan review: the plan markdown rides the question's detail. */
function planWait(key: string, question: string, plan: string) {
  return { kind: 'plan-review', key, questions: [{ id: key, question, detail: plan }], sessionId: SID }
}

afterEach(() => {
  vi.restoreAllMocks()
  StubNotification.created.length = 0
  StubNotification.permission = 'granted'
  pageHidden(false)
  delete (globalThis as { Notification?: unknown }).Notification
})

describe('apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'sessions', 'locale', 'uiConversation', 'uiSession', 'uiWorkspace'])
  })

  it('registers the settings row through deferral once the hole is declared', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entries = slots.entries('settings.general.item')
    expect(entries.some(e => e.component === NotificationSettingsRow)).toBe(true)
    await fiber.dispose()
    expect(slots.entries('settings.general.item').some(e => e.component === NotificationSettingsRow)).toBe(false)
  })

  it('notifies an approval wait on the current session while hidden, titled with the session', async () => {
    const { ctx, notify, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, approvalWait('a:rpc-1', '需要越权执行'))
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 需要审批',
      options: { body: '需要越权执行', tag: 's1:a:rpc-1', requireInteraction: true },
    })
  })

  it('notifies a question wait with the first question text', async () => {
    const { ctx, notify, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, questionWait('q:rpc-2', '选择哪个方案？'))
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 需要你的回答',
      options: { body: '选择哪个方案？', tag: 's1:q:rpc-2' },
    })
  })

  it('gives a plan-review wait its own title and shows the plan excerpt', async () => {
    const { ctx, notify, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, planWait('p:rpc-3', '是否批准该计划？', '## 计划\n1. 先改配置\n2. 再跑测试'))
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 计划待审阅',
      options: { tag: 's1:p:rpc-3' },
    })
    expect(notify.created[0]?.options.body).toContain('先改配置')
  })

  it('dedupes replay: the same wait key notifies only once', async () => {
    const { ctx, notify, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, approvalWait('a:rpc-4'))
    // Same wait re-presented (reconnect / mux replay) — silent.
    uiSession.setWait(SID, approvalWait('a:rpc-4'))
    expect(notify.created).toHaveLength(1)
  })

  it('does not notify while the page is visible', async () => {
    const { ctx, notify, uiSession } = await bench()
    pageHidden(false)
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, approvalWait('a:rpc-5'))
    expect(notify.created).toHaveLength(0)
  })

  it('does not notify without granted permission', async () => {
    const { ctx, notify, uiSession } = await bench()
    notify.permission = 'denied'
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, approvalWait('a:rpc-6'))
    expect(notify.created).toHaveLength(0)
  })

  it('clicking the notification focuses the page, jumps to the session, and closes it', async () => {
    const { ctx, notify, workspace, uiSession } = await bench()
    const focus = vi.spyOn(window, 'focus')
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, approvalWait('a:rpc-7', '越权执行'))
    const created = StubNotification.created[0]!
    created.onclick?.call(created as never, new Event('click'))
    expect(focus).toHaveBeenCalledTimes(1)
    expect(workspace.openSession).toHaveBeenCalledWith(SID)
    expect(created.closed).toBe(true)
  })

  it('rebinds when the current session moves', async () => {
    const { ctx, notify, sessions, uiSession, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const other = 's2' as SessionId
    sessions.setSummary('s2', { displayTitle: '会话二' })
    sessions.setCurrent(other)
    uiSession.setWait(other, {
      kind: 'question', key: 'q:rpc-8', questions: [{ id: 'q8', question: '新会话的问题' }], sessionId: other,
    })
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({ title: '会话二 · 需要你的回答' })
    // Turn tracking followed the move: a new turn on s2 notifies, s1's chat is ignored.
    chatOf('s1').setTurnEnds(new Map([[1, 10]]))
    chatOf(other).openWithHistory(new Map())
    chatOf(other).setTurnEnds(new Map([[1, 10]]))
    expect(notify.created).toHaveLength(2)
    expect(notify.created[1]).toMatchObject({ title: '会话二 · 轮次完成', options: { body: '第 1 轮已完成' } })
  })

  it('baselines an opened session history, then notifies only new turns', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    // The window opens with turns 1-2 already finished: absorbed as baseline.
    chatOf('s1').openWithHistory(new Map([[1, 10], [2, 20]]))
    expect(notify.created).toHaveLength(0)
    // A genuinely new turn notifies, with the final assistant text as body.
    chatOf('s1').setNodes([{ kind: 'assistant', turn: 3, blocks: [{ kind: 'text', text: '这是第三轮的最终回答。' }] }])
    chatOf('s1').setTurnEnds(new Map([[1, 10], [2, 20], [3, 30]]))
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 轮次完成',
      options: { body: '这是第三轮的最终回答。', tag: 's1:turn:3', requireInteraction: true },
    })
  })

  it('falls back to the turn-number copy for a tool-only turn with no final text', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map())
    chatOf('s1').setNodes([{ kind: 'assistant', turn: 1, blocks: [{ kind: 'tool-call', callId: 'c1', name: 'bash', argsRaw: '{}' }] }])
    chatOf('s1').setTurnEnds(new Map([[1, 10]]))
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 轮次完成',
      options: { body: '第 1 轮已完成', tag: 's1:turn:1' },
    })
  })

  it('stays silent on replay of the same finished turns', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map([[1, 10], [2, 20]]))
    expect(notify.created).toHaveLength(0)
    // New turn notifies (no nodes -> falls back to the number copy).
    chatOf('s1').setTurnEnds(new Map([[1, 10], [2, 20], [3, 30]]))
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({ options: { body: '第 3 轮已完成' } })
    // Mux replay re-presents the same map — silent.
    chatOf('s1').setTurnEnds(new Map([[1, 10], [2, 20], [3, 30]]))
    expect(notify.created).toHaveLength(1)
  })

  it('names a cut-off turn instead of claiming it finished', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map())
    chatOf('s1').setTurnEnds(new Map([[1, 10]]), new Map([[1, { kind: 'max-tokens' }]]))
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 轮次被截断',
      options: { body: '第 1 轮达到输出上限，回答被截断', tag: 's1:turn:1', requireInteraction: true },
    })
  })

  it('reports a failed turn with the harness failure message', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map())
    chatOf('s1').setTurnEnds(
      new Map([[1, 10]]),
      new Map([[1, { kind: 'error', error: { message: '模型返回 429：请求过多' } }]]),
    )
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 轮次出错',
      options: { body: '模型返回 429：请求过多', tag: 's1:turn:1' },
    })
  })

  it('reports a stopped turn instead of claiming it finished', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map())
    chatOf('s1').setTurnEnds(new Map([[1, 10]]), new Map([[1, { kind: 'aborted', reason: { kind: 'user' } }]]))
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 轮次已中止',
      options: { body: '第 1 轮被中止', tag: 's1:turn:1' },
    })
  })

  it('prefers a hook stop reason over the generic stopped copy', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map())
    chatOf('s1').setTurnEnds(
      new Map([[1, 10]]),
      new Map([[1, { kind: 'aborted', reason: { kind: 'hook', reason: 'deepseek-account/signed-out' } }]]),
    )
    expect(notify.created[0]).toMatchObject({
      title: '主会话 · 轮次已中止',
      options: { body: 'deepseek-account/signed-out' },
    })
  })

  it('stays silent for a synthetic fork turn end', async () => {
    const { ctx, notify, chatOf } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map())
    chatOf('s1').setTurnEnds(new Map([[1, 10]]), new Map([[1, { kind: 'forked' }]]))
    expect(notify.created).toHaveLength(0)
  })

  it('does not notify a new turn while the page is visible', async () => {
    const { ctx, notify, chatOf } = await bench()
    pageHidden(false)
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    chatOf('s1').openWithHistory(new Map([[1, 10]]))
    chatOf('s1').setTurnEnds(new Map([[1, 10], [2, 20]]))
    expect(notify.created).toHaveLength(0)
  })

  it('notifies a background session approval with a rich body and jumps there on click', async () => {
    const { ctx, notify, sessions, workspace, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    sessions.setSummary('s2', { displayTitle: '后台会话' })
    uiSession.setWait('s2' as SessionId, {
      kind: 'approval', key: 'a:rpc-10', toolName: 'bash', reason: '需要越权执行', sessionId: 's2',
    })
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '后台会话 · 需要审批',
      options: { body: '需要越权执行', tag: 's2:a:rpc-10', requireInteraction: true },
    })
    const created = StubNotification.created[0]!
    created.onclick?.call(created as never, new Event('click'))
    expect(workspace.openSession).toHaveBeenCalledWith('s2')
  })

  it('notifies a background session completion once per finish', async () => {
    const { ctx, notify, sessions, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    sessions.setSummary('s2', { displayTitle: '后台会话' })
    uiSession.setCompletionUnread('s2' as SessionId, true)
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '后台会话 · 会话完成',
      options: { body: '该会话已完成，可以切回查看', tag: 's2:done', requireInteraction: true },
    })
    // Still unread — no repeat.
    uiSession.setCompletionUnread('s2' as SessionId, true)
    expect(notify.created).toHaveLength(1)
    // Acknowledged (or running again), then it finishes again — notify once more.
    uiSession.setCompletionUnread('s2' as SessionId, false)
    uiSession.setCompletionUnread('s2' as SessionId, true)
    expect(notify.created).toHaveLength(2)
  })

  it('leaves the current session completion to the turn layer', async () => {
    const { ctx, notify, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    // s1 is the session shown in the main view: its completion is the turn case,
    // never the "you were elsewhere" reminder.
    uiSession.setCompletionUnread(SID, true)
    expect(notify.created).toHaveLength(0)
  })

  it('does not re-notify the same wait when its session becomes current', async () => {
    const { ctx, notify, sessions, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    sessions.setSummary('s2', { displayTitle: '后台会话' })
    uiSession.setWait('s2' as SessionId, approvalWait('a:rpc-11', '越权执行'))
    expect(notify.created).toHaveLength(1)
    // The user opens s2; the same still-pending wait must not re-fire.
    sessions.setCurrent('s2' as SessionId)
    expect(notify.created).toHaveLength(1)
    // A NEW approval wait on the now-current session notifies normally.
    uiSession.setWait('s2' as SessionId, approvalWait('a:rpc-12', '又一次越权'))
    expect(notify.created).toHaveLength(2)
    expect(notify.created[1]).toMatchObject({ title: '后台会话 · 需要审批' })
  })

  it('warns once when a notification source is gone instead of failing silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = brokenUiSession()
    const { ctx } = await bench({ uiSession: broken })
    await ctx.plugin({ inject: [...inject], apply }).await()
    // Applying already scanned the (broken) pending source once; a later
    // notification must not warn again.
    broken.fire()
    broken.fire()
    const ours = warn.mock.calls.filter(call => String(call[0]).includes('[web-ui-notify]'))
    expect(ours).toHaveLength(1)
    expect(String(ours[0]?.[0])).toContain('uiSession.sessionStatus')
  })

  it('never lets two sessions replace each other', async () => {
    const { ctx, notify, uiSession } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    uiSession.setWait(SID, approvalWait('a:rpc-23', 's1 的审批'))
    uiSession.setWait('s2' as SessionId, {
      kind: 'question', key: 'q:rpc-24', questions: [{ id: 'q24', question: 's2 的问题' }], sessionId: 's2',
    })
    expect(notify.created).toHaveLength(2)
    expect(notify.created.map(entry => entry.options.tag)).toEqual(['s1:a:rpc-23', 's2:q:rpc-24'])
  })
})
