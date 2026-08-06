/**
 * apply wiring on a real cordis Context + SlotsService + LocaleService with a
 * scripted sessions face: settings-row registration through deferral, the
 * current-session pending scan, desktop-notification firing gated on page
 * visibility, replay dedupe, and fiber-teardown cleanup.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from 'cordis'
import { SlotsService } from '@deepseek-ai/dsh-client-runtime/client'
import type { ISessions, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleService } from '@deepseek-ai/dsh-client-locale/client'
import { NotificationSettingsRow } from '../src/client/NotificationSettingsRow.tsx'
import { apply, inject } from '../src/client/index.ts'

const SID = 's1' as SessionId

/** Scripted notification: construct from options, record the instance, and let the test fire onclick. */
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

/** Scripted session snapshot: pending waits, completed turns, nodes, open state. */
function scriptedSession() {
  const listeners = new Set<() => void>()
  let pending: readonly unknown[] = []
  let turnEnds: ReadonlyMap<number, number> = new Map()
  let nodes: readonly unknown[] = []
  // Starts loading like a real window the plugin boots into; the bench or a
  // test flips it to 'open' once history is present.
  let openState = 'loading'
  return {
    subscribe(fn: () => void): () => void {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    setPending(next: readonly unknown[]): void {
      pending = next
      for (const fn of [...listeners]) fn()
    },
    setTurnEnds(next: ReadonlyMap<number, number>): void {
      turnEnds = next
      for (const fn of [...listeners]) fn()
    },
    setNodes(next: readonly unknown[]): void {
      nodes = next
      for (const fn of [...listeners]) fn()
    },
    setOpenState(next: string): void {
      openState = next
      for (const fn of [...listeners]) fn()
    },
    /** Atomically flip both the open state and the completed-turn map (one scan). */
    openWithHistory(next: ReadonlyMap<number, number>): void {
      openState = 'open'
      turnEnds = next
      for (const fn of [...listeners]) fn()
    },
    getSnapshot(): {
      pending: readonly unknown[]
      turnEnds: ReadonlyMap<number, number>
      nodes: readonly unknown[]
      openState: string
    } {
      return { pending, turnEnds, nodes, openState }
    },
  }
}

/** Scripted sessions service face: list store + current-session binding. */
function scriptedSessions() {
  const session = scriptedSession()
  const listeners = new Set<() => void>()
  let current: SessionId | undefined = SID
  return {
    list: {
      subscribe(fn: () => void): () => void {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
      getSnapshot(): { current: SessionId | undefined } { return { current } },
    },
    binding(id: SessionId): { session: ReturnType<typeof scriptedSession> } | undefined {
      return id === current ? { session } : undefined
    },
    setCurrent(next: SessionId | undefined): void {
      current = next
      for (const fn of [...listeners]) fn()
    },
    setPending(next: readonly unknown[]): void { session.setPending(next) },
    setTurnEnds(next: ReadonlyMap<number, number>): void { session.setTurnEnds(next) },
    setNodes(next: readonly unknown[]): void { session.setNodes(next) },
    setOpenState(next: string): void { session.setOpenState(next) },
    openWithHistory(next: ReadonlyMap<number, number>): void { session.openWithHistory(next) },
    session,
  }
}

/** Assemble a bench: real cordis ctx with slots/locale provided and sessions scripted. */
async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotsService).await()
  const slots = ctx.get('slots') as SlotsService
  // The settings.general.item hole exists only while its declaring entry is live.
  slots.register(
    { name: 'root', children: { 'settings.general.item': { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
  const sessions = scriptedSessions()
  ctx.provide('sessions', sessions as unknown as ISessions)
  const locale = new LocaleService(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  Object.assign(globalThis, { Notification: StubNotification })
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  return { ctx, slots, sessions, notify: StubNotification }
}

afterEach(() => {
  vi.restoreAllMocks()
  StubNotification.created.length = 0
  StubNotification.permission = 'granted'
  // Restore a visible page for the next test.
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  delete (globalThis as { Notification?: unknown }).Notification
})

describe('apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'sessions', 'locale'])
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

  it('notifies an approval wait on the current session while hidden', async () => {
    const { ctx, notify } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const approval = {
      kind: 'approval',
      key: 'a:rpc-1',
      payload: { approvalId: 'ap-1', toolName: 'bash', reason: '需要越权执行' },
    }
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setPending([approval])
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '需要审批',
      options: { body: '需要越权执行', tag: 'a:rpc-1', requireInteraction: true },
    })
  })

  it('notifies a question wait with the first question text', async () => {
    const { ctx, notify } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const question = {
      kind: 'question',
      key: 'q:rpc-2',
      payload: { questions: [{ id: 'q1', question: '选择哪个方案？', options: [{ label: 'A' }] }] },
    }
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setPending([question])
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '需要你的回答',
      options: { body: '选择哪个方案？', tag: 'q:rpc-2' },
    })
  })

  it('dedupes replay: the same wait key notifies only once', async () => {
    const { ctx, notify } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const approval = {
      kind: 'approval',
      key: 'a:rpc-3',
      payload: { approvalId: 'ap-3', toolName: 'bash' },
    }
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setPending([approval])
    sessions.setPending([approval])
    expect(notify.created).toHaveLength(1)
  })

  it('does not notify while the page is visible', async () => {
    const { ctx, notify } = await bench()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const approval = {
      kind: 'approval',
      key: 'a:rpc-4',
      payload: { approvalId: 'ap-4', toolName: 'bash' },
    }
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setPending([approval])
    expect(notify.created).toHaveLength(0)
  })

  it('does not notify without granted permission', async () => {
    const { ctx, notify } = await bench()
    notify.permission = 'denied'
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const approval = {
      kind: 'approval',
      key: 'a:rpc-5',
      payload: { approvalId: 'ap-5', toolName: 'bash' },
    }
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setPending([approval])
    expect(notify.created).toHaveLength(0)
  })

  it('clicking the notification focuses the page and closes it', async () => {
    const { ctx, notify } = await bench()
    const focus = vi.spyOn(window, 'focus')
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const approval = {
      kind: 'approval',
      key: 'a:rpc-7',
      payload: { approvalId: 'ap-7', toolName: 'bash', reason: '越权执行' },
    }
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setPending([approval])
    const created = StubNotification.created[0]!
    created.onclick?.call(created as never, new Event('click'))
    expect(focus).toHaveBeenCalledTimes(1)
    expect(created.closed).toBe(true)
  })

  it('rebinds when the current session moves', async () => {
    const { ctx, notify } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const other = 's2' as SessionId
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setCurrent(other)
    // binding() for the new current returns the same scripted session here,
    // so a pending wait pushed after the move still reaches the scan.
    sessions.setPending([{
      kind: 'question',
      key: 'q:rpc-6',
      payload: { questions: [{ id: 'q6', question: '新会话的问题' }] },
    }])
    expect(notify.created).toHaveLength(1)
  })

  it('baselines an opened session history, then notifies only new turns', async () => {
    const { ctx, notify } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    // Apply-time scan ran while the session was loading, so no baseline was
    // absorbed. The window then opens atomically with turns 1–2 already
    // finished: that first open scan absorbs them as baseline — no spam.
    sessions.openWithHistory(new Map([[1, 10], [2, 20]]))
    expect(notify.created).toHaveLength(0)
    // A genuinely new turn notifies, with the final assistant text as body.
    sessions.setNodes([{ kind: 'assistant', turn: 3, blocks: [{ kind: 'text', text: '这是第三轮的最终回答。' }] }])
    sessions.setTurnEnds(new Map([[1, 10], [2, 20], [3, 30]]))
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({
      title: '轮次完成',
      options: { body: '这是第三轮的最终回答。', tag: 'turn:3', requireInteraction: true },
    })
  })

  it('falls back to the turn-number copy for a tool-only turn with no final text', async () => {
    const { ctx, notify } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    // Open with an empty baseline first, then turn 1 finishes with only tool
    // blocks (no text): the body falls back to the number copy.
    sessions.openWithHistory(new Map())
    sessions.setNodes([{ kind: 'assistant', turn: 1, blocks: [{ kind: 'tool-call', callId: 'c1', name: 'bash', argsRaw: '{}' }] }])
    sessions.setTurnEnds(new Map([[1, 10]]))
    expect(notify.created[0]).toMatchObject({
      title: '轮次完成',
      options: { body: '第 1 轮已完成', tag: 'turn:1' },
    })
  })

  it('ignores turn completions before the window opens, and replay after', async () => {
    const { ctx, notify } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    // While loading (history not yet present) turn completions are not tracked.
    sessions.setTurnEnds(new Map([[1, 10]]))
    expect(notify.created).toHaveLength(0)
    // Window opens atomically with turns 1–2 now present: baseline, silent.
    sessions.openWithHistory(new Map([[1, 10], [2, 20]]))
    expect(notify.created).toHaveLength(0)
    // New turn notifies (no nodes -> falls back to the number copy).
    sessions.setTurnEnds(new Map([[1, 10], [2, 20], [3, 30]]))
    expect(notify.created).toHaveLength(1)
    expect(notify.created[0]).toMatchObject({ options: { body: '第 3 轮已完成' } })
    // Mux replay re-presents the same map — silent.
    sessions.setTurnEnds(new Map([[1, 10], [2, 20], [3, 30]]))
    expect(notify.created).toHaveLength(1)
  })

  it('does not notify a new turn while the page is visible', async () => {
    const { ctx, notify } = await bench()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await ctx.plugin({ inject: [...inject], apply }).await()
    notify.created.length = 0
    const sessions = ctx.get('sessions') as unknown as ReturnType<typeof scriptedSessions>
    sessions.setTurnEnds(new Map([[1, 10]]))
    sessions.setTurnEnds(new Map([[1, 10], [2, 20]]))
    expect(notify.created).toHaveLength(0)
  })
})
