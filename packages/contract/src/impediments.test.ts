import { describe, expect, it } from 'vitest'
import {
  assignImpedimentInputSchema,
  blockTaskInputSchema,
  impedimentDtoSchema,
  listImpedimentsInputSchema,
  resolveImpedimentInputSchema,
  taskDtoSchema,
  unblockTaskInputSchema,
} from './index'

const ulid = (n: number) => String(n).padStart(26, '0')
const dto = {
  id: ulid(1),
  taskId: ulid(2),
  status: 'open',
  reason: 'Aguardando acesso',
  ownerId: null,
  ownerName: null,
  openedBy: ulid(3),
  openedAt: '2026-01-02T10:00:00.000Z',
  resolvedBy: null,
  resolvedAt: null,
  resolution: null,
}

describe('contrato de impedimentos', () => {
  it('o impedimento aceita o registro aberto e o resolvido com nota', () => {
    expect(impedimentDtoSchema.parse(dto)).toMatchObject({ status: 'open' })
    expect(
      impedimentDtoSchema.parse({
        ...dto,
        status: 'resolved',
        resolvedBy: ulid(3),
        resolvedAt: '2026-01-03T10:00:00.000Z',
        resolution: 'Liberado',
      }),
    ).toMatchObject({ resolution: 'Liberado' })
    expect(() => impedimentDtoSchema.parse({ ...dto, status: 'closed' })).toThrow()
  })

  it('bloquear aceita responsável opcional; desbloquear aceita nota opcional, com o limite de 280', () => {
    expect(blockTaskInputSchema.parse({ taskId: ulid(4), reason: 'Motivo' })).toMatchObject({
      reason: 'Motivo',
    })
    expect(
      blockTaskInputSchema.parse({ taskId: ulid(4), reason: 'Motivo', ownerId: ulid(5) }),
    ).toMatchObject({ ownerId: ulid(5) })
    expect(unblockTaskInputSchema.parse({ taskId: ulid(4) })).toEqual({ taskId: ulid(4) })
    expect(() =>
      unblockTaskInputSchema.parse({ taskId: ulid(4), resolution: 'x'.repeat(281) }),
    ).toThrow()
  })

  it('lista, atribuição e resolução validam os identificadores e a nota', () => {
    expect(listImpedimentsInputSchema.parse({})).toEqual({})
    expect(assignImpedimentInputSchema.parse({ impedimentId: ulid(1), ownerId: null })).toEqual({
      impedimentId: ulid(1),
      ownerId: null,
    })
    expect(resolveImpedimentInputSchema.parse({ impedimentId: ulid(1) })).toEqual({
      impedimentId: ulid(1),
    })
    expect(() => resolveImpedimentInputSchema.parse({ impedimentId: 'curto' })).toThrow()
  })

  it('a tarefa aceita o resumo do impedimento e respostas antigas sem o campo', () => {
    const base = {
      id: ulid(4),
      number: 1,
      key: 'AB-1',
      projectId: ulid(6),
      projectName: 'Projeto',
      title: 'Tarefa',
      description: '',
      status: 'todo',
      priority: 'normal',
      blockedReason: null,
      blockedAt: null,
      deadline: null,
      ticketId: null,
      ticketUrl: null,
      createdAt: '2026-01-02T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
      checklistProgress: { done: 0, total: 0, percent: 0 },
      commentCount: 0,
    }
    expect(taskDtoSchema.parse(base).impediment).toBeUndefined()
    expect(
      taskDtoSchema.parse({
        ...base,
        blockedReason: 'Aguardando acesso',
        blockedAt: '2026-01-02T10:00:00.000Z',
        impediment: {
          id: ulid(7),
          status: 'open',
          reason: 'Aguardando acesso',
          ownerId: null,
          ownerName: null,
          openedAt: '2026-01-02T10:00:00.000Z',
        },
      }).impediment,
    ).toMatchObject({ status: 'open' })
  })
})
