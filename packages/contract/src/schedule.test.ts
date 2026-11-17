import { describe, expect, it } from 'vitest'
import { scheduleViewDtoSchema, setTaskStartInputSchema, taskDtoSchema } from './index'

const ulid = (n: number) => String(n).padStart(26, '0')

describe('contrato do cronograma', () => {
  it('aceita início nulo ou data válida na troca de início', () => {
    expect(
      setTaskStartInputSchema.safeParse({ taskId: ulid(1), startsOn: '2026-04-01' }).success,
    ).toBe(true)
    expect(setTaskStartInputSchema.safeParse({ taskId: ulid(1), startsOn: null }).success).toBe(
      true,
    )
    expect(
      setTaskStartInputSchema.safeParse({ taskId: ulid(1), startsOn: '2026-02-30' }).success,
    ).toBe(false)
  })

  it('o progresso do cronograma é só 0 ou 100', () => {
    const row = {
      taskId: ulid(1),
      key: 'AB-1',
      title: 'Tarefa',
      status: 'todo',
      deliverableId: null,
      deliverableCode: null,
      startsOn: null,
      deadline: null,
      responsibleName: null,
      done: false,
      canEdit: true,
    }
    const view = {
      projectId: ulid(2),
      canEdit: true,
      range: null,
      dependencies: [],
      milestones: [],
      today: '2026-01-02',
    }
    expect(
      scheduleViewDtoSchema.safeParse({ ...view, tasks: [{ ...row, progress: 0 }] }).success,
    ).toBe(true)
    expect(
      scheduleViewDtoSchema.safeParse({ ...view, tasks: [{ ...row, progress: 50 }] }).success,
    ).toBe(false)
  })

  it('a tarefa carrega o início opcional, e respostas antigas (sem o campo) continuam válidas', () => {
    const startsOn = taskDtoSchema.shape.startsOn
    expect(startsOn.safeParse('2026-04-01').success).toBe(true)
    expect(startsOn.safeParse(null).success).toBe(true)
    expect(startsOn.safeParse(undefined).success).toBe(true)
    expect(startsOn.safeParse('2026-02-30').success).toBe(false)
  })
})
