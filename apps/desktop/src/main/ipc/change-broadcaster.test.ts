import { describe, expect, it } from 'vitest'
import { toOrganizationId } from '@agilebox/core'
import { ChangeBroadcaster } from './change-broadcaster.js'

describe('notificador de mudanças', () => {
  it('envia a mudança para cada janela aberta', async () => {
    const messages: unknown[] = []
    const broadcaster = new ChangeBroadcaster({
      getAll: () => [
        { send: (channel, payload) => void messages.push({ channel, payload }) },
        { send: (channel, payload) => void messages.push({ channel, payload }) },
      ],
    })
    const organizationId = toOrganizationId('00000000000000000000000001')
    const change = { kind: 'task' as const, ids: ['task-1'] }

    await broadcaster.publish(organizationId, change)

    expect(messages).toEqual([
      { channel: 'changes', payload: { organizationId, change } },
      { channel: 'changes', payload: { organizationId, change } },
    ])
  })
})
