import { describe, expect, it, vi } from 'vitest'
import { API_CHANNELS } from '@agilebox/contract'
import { toOrganizationId, toUserId } from '@agilebox/core'
import { registerHandlers } from './register-handlers'

describe('registro dos handlers IPC', () => {
  it('registra exatamente um handler para cada canal da API', () => {
    const registered: string[] = []
    const ipcMain = {
      handle: (channel: string) => registered.push(channel),
    }

    registerHandlers(
      ipcMain,
      {} as Parameters<typeof registerHandlers>[1],
      {
        get: vi.fn(() => ({
          userId: toUserId('00000000000000000000000002'),
          organizationId: toOrganizationId('00000000000000000000000001'),
          role: 'collaborator' as const,
        })),
        set: vi.fn(),
      },
      vi.fn(),
    )

    expect(registered).toHaveLength(API_CHANNELS.length)
    expect(new Set(registered)).toEqual(new Set(API_CHANNELS))
  })
})
