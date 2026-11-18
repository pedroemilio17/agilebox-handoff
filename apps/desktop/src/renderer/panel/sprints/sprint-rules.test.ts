import { describe, expect, it } from 'vitest'
import type { SprintDto, SprintHistoryRowDto, TaskDto } from '@agilebox/contract'
import {
  arrowRange,
  carryTargets,
  closeSummary,
  groupByStatus,
  heldByOtherSprint,
  midSprintTaskIds,
  paceAgainstIdeal,
  progressOf,
  remainingHours,
  replanDates,
  sprintMarker,
  sumHours,
  validateSprintForm,
  weekdayDate,
  workingDays,
} from './sprint-rules'
import { parseDateOnly } from '@agilebox/core'

const PROJECT = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const SPRINT_A = '01J8Y4G2XK8Z1S6M3Q9W0S001'
const SPRINT_B = '01J8Y4G2XK8Z1S6M3Q9W0S002'

function task(id: string, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    number: 1,
    key: 'AB-1',
    projectId: PROJECT,
    projectName: 'Projeto Aurora',
    title: `Tarefa ${id}`,
    description: '',
    status: 'todo',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    archivedAt: null,
    estimatedHours: null,
    actualHours: 0,
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    checklistProgress: { done: 0, total: 0, percent: 0 },
    commentCount: 0,
    ...overrides,
  }
}

function sprint(overrides: Partial<SprintDto> = {}): SprintDto {
  return {
    id: SPRINT_A,
    projectId: PROJECT,
    number: 4,
    label: 'Sprint 4',
    name: 'Sprint 4',
    goal: null,
    plannedStart: '2026-11-02',
    plannedEnd: '2026-11-15',
    status: 'draft',
    startedAt: null,
    closedAt: null,
    closePolicy: null,
    createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V09',
    createdAt: '2026-10-31T12:00:00.000Z',
    ...overrides,
  }
}

describe('validateSprintForm', () => {
  const valid = {
    name: '',
    goal: '',
    plannedStart: '2026-11-16',
    plannedEnd: '2026-11-29',
  }

  it('aceita nome e meta vazios e datas em ordem', () => {
    expect(validateSprintForm(valid)).toEqual({})
  })

  it('pede as duas datas', () => {
    expect(validateSprintForm({ ...valid, plannedStart: '', plannedEnd: '' })).toEqual({
      plannedStart: 'Informe a data de início.',
      plannedEnd: 'Informe a data de fim.',
    })
  })

  it('recusa início depois do fim, com a mensagem do domínio', () => {
    expect(
      validateSprintForm({ ...valid, plannedStart: '2026-11-30', plannedEnd: '2026-11-01' })
        .plannedEnd,
    ).toBe('A data de início não pode ser depois da data de fim')
  })

  it('recusa nome acima de 80 e meta acima de 280 caracteres', () => {
    const errors = validateSprintForm({ ...valid, name: 'a'.repeat(81), goal: 'b'.repeat(281) })
    expect(errors.name).toBe('Nome da sprint deve ter até 80 caracteres')
    expect(errors.goal).toBe('Meta da sprint deve ter até 280 caracteres')
  })

  it('aceita meta de exatamente 280 caracteres', () => {
    expect(validateSprintForm({ ...valid, goal: 'b'.repeat(280) })).toEqual({})
  })
})

describe('somas, grupos e progresso', () => {
  const items = [
    task('1', { status: 'done', estimatedHours: 2, actualHours: 1.5 }),
    task('2', { status: 'in_progress', estimatedHours: 3, actualHours: 0 }),
    task('3', { status: 'planning', estimatedHours: null }),
  ]

  it('soma horas estimadas e realizadas, tratando ausência como zero', () => {
    expect(sumHours(items)).toEqual({ estimated: 5, actual: 1.5 })
  })

  it('agrupa por estado na ordem do mini-quadro, mesmo sem itens', () => {
    const groups = groupByStatus(items)
    expect(Object.keys(groups)).toEqual(['planning', 'todo', 'in_progress', 'review', 'done'])
    expect(groups.in_progress.map((item) => item.id)).toEqual(['2'])
    expect(groups.review).toEqual([])
  })

  it('progresso conta concluídos sobre o total, e zero sem itens', () => {
    expect(progressOf(items)).toEqual({ done: 1, total: 3 })
    expect(progressOf([])).toEqual({ done: 0, total: 0 })
  })
})

describe('encerramento', () => {
  it('separa concluídos, abertos e já iniciados (Desenvolvendo ou Revisar)', () => {
    const items = [
      task('1', { status: 'done' }),
      task('2', { status: 'in_progress' }),
      task('3', { status: 'review' }),
      task('4', { status: 'todo' }),
      task('5', { status: 'planning' }),
    ]
    expect(closeSummary(items)).toEqual({ done: 1, open: 4, started: 2 })
  })
})

describe('histórico e marcadores', () => {
  const history: SprintHistoryRowDto[] = [
    {
      taskId: 'early',
      taskKey: 'AB-1',
      taskTitle: 'Antes',
      addedAt: '2026-11-01T09:00:00.000Z',
      addedBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V09',
      removedAt: null,
      removedBy: null,
      outcome: 'open',
    },
    {
      taskId: 'late',
      taskKey: 'AB-2',
      taskTitle: 'Depois',
      addedAt: '2026-11-05T09:00:00.000Z',
      addedBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V09',
      removedAt: null,
      removedBy: null,
      outcome: 'open',
    },
    {
      taskId: 'gone',
      taskKey: 'AB-3',
      taskTitle: 'Saiu',
      addedAt: '2026-11-06T09:00:00.000Z',
      addedBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V09',
      removedAt: '2026-11-07T09:00:00.000Z',
      removedBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V09',
      outcome: 'removed',
    },
  ]

  it('marca como "no meio da sprint" só as linhas abertas que entraram depois do início', () => {
    const started = sprint({ status: 'active', startedAt: '2026-11-03T10:00:00.000Z' })
    expect([...midSprintTaskIds(history, started)]).toEqual(['late'])
  })

  it('sem início, nada é marcado', () => {
    expect(midSprintTaskIds(history, sprint()).size).toBe(0)
  })

  it('marcador "Sprint N" vem da sprint aberta; nulo sem sprint', () => {
    expect(sprintMarker({ sprint: { id: SPRINT_A, number: 4, name: 'x', status: 'active' } })).toBe(
      'Sprint 4',
    )
    expect(sprintMarker({ sprint: null })).toBeNull()
  })

  it('item com sprint aberta diferente desta não pode ser adicionado de novo', () => {
    const other = { sprint: { id: SPRINT_B, number: 5, name: 'y', status: 'draft' as const } }
    expect(heldByOtherSprint(other, SPRINT_A)).toBe(true)
    expect(heldByOtherSprint(other, SPRINT_B)).toBe(false)
    expect(heldByOtherSprint({ sprint: null }, SPRINT_A)).toBe(false)
  })
})

describe('replanejamento e destinos do encerramento', () => {
  it('replanejar mantém a duração da sprint de origem, começando na data dada', () => {
    const dates = replanDates(
      { plannedStart: '2026-11-02', plannedEnd: '2026-11-15' },
      parseDateOnly('2026-11-20'),
    )
    expect(dates).toEqual({ plannedStart: '2026-11-20', plannedEnd: '2026-12-03' })
  })

  it('só rascunhos do mesmo projeto, diferentes da sprint encerrada, podem receber itens', () => {
    const list = [
      sprint({ id: SPRINT_A, status: 'closed' }),
      sprint({ id: SPRINT_B, status: 'draft' }),
      sprint({ id: '01J8Y4G2XK8Z1S6M3Q9W0S003', status: 'draft', projectId: 'OTHER' }),
      sprint({ id: '01J8Y4G2XK8Z1S6M3Q9W0S004', status: 'active' }),
    ]
    expect(carryTargets(list, PROJECT, SPRINT_A).map((item) => item.id)).toEqual([SPRINT_B])
  })
})

describe('Layout do design: horas restantes, dias úteis e datas', () => {
  it('remainingHours soma a estimativa do que não está concluído (sem estimativa conta zero)', () => {
    const items = [
      { status: 'todo', estimatedHours: 8 },
      { status: 'in_progress', estimatedHours: 6 },
      { status: 'done', estimatedHours: 10 },
      { status: 'review', estimatedHours: null },
    ] as unknown as TaskDto[]
    expect(remainingHours(items)).toBe(14)
    expect(remainingHours([])).toBe(0)
  })

  it('workingDays conta de segunda a sexta, com as duas pontas', () => {
    // 24/11/2026 é terça e 05/12/2026 é sábado: 9 dias úteis.
    expect(workingDays('2026-11-24', '2026-12-05')).toBe(9)
    expect(workingDays('2026-11-21', '2026-11-21')).toBe(0)
    expect(workingDays('2026-11-16', '2026-11-20')).toBe(5)
  })

  it('weekdayDate e arrowRange seguem o calendário real', () => {
    expect(weekdayDate('2026-11-24')).toBe('ter 24/11')
    expect(arrowRange('2026-11-10', '2026-11-21')).toBe('10/11 → 21/11')
  })

  it('paceAgainstIdeal diz quantos dias a sprint está atrás da linha ideal', () => {
    // Ideal cai 2,8 h por dia; no dia 8 (índice 7) o restante é 16 h, igual ao ideal do dia 6.
    const days = Array.from({ length: 11 }, (_, index) => ({
      date: `2026-11-${String(10 + index).padStart(2, '0')}`,
      idealHours: 28 - 2.8 * index,
      remainingHours: index <= 7 ? [28, 26, 24, 22, 20, 18, 16, 16][index]! : null,
    }))
    expect(paceAgainstIdeal(days, '2026-11-17')).toEqual({ day: 8, total: 11, lagDays: 2 })
    // No dia 1, restante igual ao ideal: no prazo.
    expect(paceAgainstIdeal(days, '2026-11-10')).toEqual({ day: 1, total: 11, lagDays: 0 })
  })

  it('paceAgainstIdeal sem medição do dia não inventa atraso', () => {
    const days = [
      { date: '2026-11-10', idealHours: 10, remainingHours: null },
      { date: '2026-11-11', idealHours: 5, remainingHours: null },
    ]
    expect(paceAgainstIdeal(days, '2026-11-10')).toEqual({ day: 1, total: 2, lagDays: null })
    expect(paceAgainstIdeal([], '2026-11-10')).toBeNull()
  })
})
