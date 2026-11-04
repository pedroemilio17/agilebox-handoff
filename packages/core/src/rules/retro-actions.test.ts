import { describe, expect, it } from 'vitest'
import { createMeeting } from '../entities/meeting'
import type { Meeting } from '../entities/meeting'
import type { RetroAction } from '../entities/retro-action'
import { ValidationError } from '../shared/errors'
import { toMeetingId, toOrganizationId, toRetroActionId, toUserId } from '../shared/ids'
import type { UserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import {
  addRetroAction,
  changeRetroActionDueDate,
  changeRetroActionResponsible,
  countRetroActions,
  isRetroOccurrence,
  RETRO_ACTIONS_MAX_PER_OCCURRENCE,
  renameRetroAction,
  setRetroActionDone,
} from './retro-actions'

const orgId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const userId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const otherUserId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX')
const retroId = toMeetingId('01ARZ3NDEKTSV4RRFFQ69G5FB0')

function retro(overrides: Partial<Meeting> = {}): Meeting {
  return createMeeting({
    id: retroId,
    organizationId: orgId,
    title: 'Retrospectiva da entrega',
    date: parseDateOnly('2026-11-06'),
    time: '16:00',
    endTime: '17:00',
    kind: 'retro',
    recurrence: 'weekly',
    recurrenceUntil: null,
    participants: [userId],
    createdBy: userId,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  })
}

let counter = 0
function draft(overrides: Partial<Parameters<typeof addRetroAction>[2]> = {}) {
  counter += 1
  return {
    id: toRetroActionId(`01ARZ3NDEKTSV4RRFFQ69G${String(counter).padStart(4, '0')}`),
    occurrenceDate: '2026-11-06',
    title: 'Combinar revisão de testes',
    responsibleId: userId as UserId | null,
    dueDate: '2026-11-13' as string | null,
    createdBy: userId,
    createdAt: '2026-11-06T16:30:00.000Z',
    ...overrides,
  }
}

function add(meeting: Meeting, existing: readonly RetroAction[] = [], overrides = {}) {
  return addRetroAction(meeting, existing, draft(overrides))
}

describe('ocorrências de retro', () => {
  it('só agendamentos do tipo Retro são elegíveis', () => {
    const meeting = retro({ kind: 'review' })
    expect(isRetroOccurrence(meeting, parseDateOnly('2026-11-06'))).toBe(false)
    expect(() => add(meeting)).toThrow('Só agendamentos do tipo Retro aceitam combinados')
  })

  it('a data precisa ser uma ocorrência válida da série', () => {
    expect(isRetroOccurrence(retro(), parseDateOnly('2026-11-13'))).toBe(true)
    expect(isRetroOccurrence(retro(), parseDateOnly('2026-11-12'))).toBe(false)
    expect(() => add(retro(), [], { occurrenceDate: '2026-11-12' })).toThrow(
      'Data não é uma ocorrência deste agendamento',
    )
  })

  it('avulso aceita só a própria data', () => {
    const single = retro({ recurrence: 'none' })
    expect(() => add(single, [], { occurrenceDate: '2026-11-06' })).not.toThrow()
    expect(() => add(single, [], { occurrenceDate: '2026-11-13' })).toThrow(ValidationError)
  })

  it('série encerrada não aceita combinados depois da data limite', () => {
    const meeting = retro({ recurrenceUntil: parseDateOnly('2026-11-13') })
    expect(isRetroOccurrence(meeting, parseDateOnly('2026-11-20'))).toBe(false)
  })
})

describe('combinados', () => {
  it('cria com título aparado, responsável usuário e estado inicial', () => {
    const created = add(retro(), [], { title: '  Documentar fluxo  ' })
    expect(created).toMatchObject({
      organizationId: orgId,
      meetingId: retroId,
      occurrenceDate: '2026-11-06',
      title: 'Documentar fluxo',
      responsibleId: userId,
      dueDate: '2026-11-13',
      done: false,
      doneAt: null,
    })
  })

  it('recusa prazo anterior à ocorrência', () => {
    expect(() => add(retro(), [], { dueDate: '2026-11-05' })).toThrow(ValidationError)
  })

  it('limita a 30 combinados por ocorrência, sem contar as outras datas', () => {
    const full: RetroAction[] = []
    for (let index = 0; index < RETRO_ACTIONS_MAX_PER_OCCURRENCE; index++) {
      full.push(add(retro(), full))
    }
    expect(() => add(retro(), full)).toThrow(
      `Limite de ${RETRO_ACTIONS_MAX_PER_OCCURRENCE} combinados por ocorrência`,
    )
    expect(() => add(retro(), full, { occurrenceDate: '2026-11-13' })).not.toThrow()
  })

  it('renomeia, troca responsável e prazo, marca e desmarca', () => {
    const base = add(retro())
    expect(renameRetroAction(base, '  Novo título ').title).toBe('Novo título')
    expect(() => renameRetroAction(base, '')).toThrow(ValidationError)
    expect(changeRetroActionResponsible(base, otherUserId).responsibleId).toBe(otherUserId)
    expect(changeRetroActionResponsible(base, null).responsibleId).toBeNull()
    expect(changeRetroActionDueDate(base, null).dueDate).toBeNull()
    expect(() => changeRetroActionDueDate(base, '2026-11-01')).toThrow(ValidationError)

    const done = setRetroActionDone(base, true, '2026-11-07T10:00:00.000Z')
    expect(done).toMatchObject({ done: true, doneAt: '2026-11-07T10:00:00.000Z' })
    expect(setRetroActionDone(done, false, '2026-11-08T10:00:00.000Z')).toMatchObject({
      done: false,
      doneAt: null,
    })
  })

  it('conta total e concluídos por ocorrência', () => {
    const first = add(retro())
    const second = add(retro(), [first])
    const done = setRetroActionDone(first, true, '2026-11-07T10:00:00.000Z')
    const other = add(retro(), [], { occurrenceDate: '2026-11-13' })
    const counts = countRetroActions([done, second, other])
    const byDate = new Map(counts.map((count) => [count.occurrenceDate, count]))
    expect(byDate.get(parseDateOnly('2026-11-06'))).toMatchObject({ total: 2, done: 1 })
    expect(byDate.get(parseDateOnly('2026-11-13'))).toMatchObject({ total: 1, done: 0 })
    expect(countRetroActions([])).toEqual([])
  })
})
