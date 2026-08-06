// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { NotificationSettingsRow, permissionState } from '../src/client/NotificationSettingsRow.tsx'
import { en } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (globalThis as { Notification?: unknown }).Notification
})

/** Stub Notification with a scripted permission state. */
function stubNotification(permission: NotificationPermission) {
  const requestPermission = vi.fn(async (): Promise<NotificationPermission> => 'granted')
  class Stub {
    static permission = permission
    static requestPermission = requestPermission
    close(): void {}
  }
  Object.assign(globalThis, { Notification: Stub })
  return { requestPermission }
}

function mount() {
  const props = {
    useSessions: (() => { throw new Error('unused') }) as never,
    useWorkspaces: (() => { throw new Error('unused') }) as never,
    t: makeTranslate(en),
  }
  render(<NotificationSettingsRow {...props} />)
}

describe('NotificationSettingsRow', () => {
  it('shows the granted state without a request button', () => {
    stubNotification('granted')
    mount()
    expect(screen.getByText('Desktop notifications')).toBeDefined()
    expect(screen.getByText('On')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the request button on the default state and requests permission', async () => {
    const { requestPermission } = stubNotification('default')
    mount()
    expect(screen.getByText('Not granted')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Enable desktop notifications' }))
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('shows the denied state with a retry button', () => {
    stubNotification('denied')
    mount()
    expect(screen.getByText('Blocked by the browser')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Enable desktop notifications' })).toBeDefined()
  })

  it('reports unsupported without a request button', () => {
    mount()
    expect(screen.getByText('Not supported')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('permissionState reads the browser permission', () => {
    stubNotification('granted')
    expect(permissionState()).toBe('granted')
    stubNotification('denied')
    expect(permissionState()).toBe('denied')
    expect(permissionState()).toBe('denied')
  })
})
