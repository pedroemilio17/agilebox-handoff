import { describe, expect, it } from 'vitest'
import type { BaselineTask } from '../entities/baseline'
import { normalizeBaselineName, BASELINE_NAME_MAX_LENGTH } from '../entities/baseline'
import { createTask } from '../entities/task'
import type { Task } from '../entities/task'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import { ValidationError } from '../shared/errors'
import { parseDateOnly } from '../values/date-only'
import { baselineSummary, hasPlanDates, isInComparison, planOf, taskDeviation } from './baseline'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(1))
const project = toProjectId(id(1))
const manager = toUserId(id(2))
const day = (value: string) => parseDateOnly(value)

/** Tarefa de teste: datas, estimativa e Responsável com valor/hora (centavos). */
function task(
  n: number,
  options: {
    starts?: string | null
    ends?: string | null
    hours?: number | null
    rateCents?: number
    archived?: boolean
  } = {},
): Task {
  const base = createTask({
    id: toTaskId(id(100 + n)),
    organizationId: org,
    number: n,
    projectId: project,
    projectName: 'Projeto',
    createdBy: manager,
    title: `Tarefa ${n}`,
    createdAt: '2026-11-01T12:00:00.000Z',
    responsibleParticipationId: toParticipationId(id(300 + n)),
    responsibleRateCents: options.rateCents ?? 0,
  })
  return {
    ...base,
    startsOn:
      options.starts === undefined ? null : options.starts === null ? null : day(options.starts),
    deadline: options.ends === undefined ? null : options.ends === null ? null : day(options.ends),
    estimatedHoursHundredths:
      options.hours === undefined || options.hours === null ? null : options.hours * 100,
    archivedAt: options.archived ? '2026-11-05T12:00:00.000Z' : null,
  }
}

/** Linha da foto, com os mesmos campos do plano atual. */
function plan(
  taskId: number,
  options: {
    starts?: string | null
    ends?: string | null
    hours?: number | null
    cost?: number | null
  } = {},
): BaselineTask {
  return {
    taskId: toTaskId(id(100 + taskId)),
    title: `Tarefa ${taskId}`,
    startsOn: options.starts ? day(options.starts) : null,
    endsOn: options.ends ? day(options.ends) : null,
    estimatedHoursHundredths:
      options.hours === undefined || options.hours === null ? null : options.hours * 100,
    plannedCostCents: options.cost ?? null,
  }
}

describe('planOf: plano atual da tarefa', () => {
  it('usa início, prazo e horas da tarefa, e o custo do Responsável (valor do envolvimento)', () => {
    const current = planOf(
      task(1, { starts: '2026-11-02', ends: '2026-11-10', hours: 8, rateCents: 5000 }),
      () => 0,
      true,
    )
    expect(current).toMatchObject({
      startsOn: '2026-11-02',
      endsOn: '2026-11-10',
      estimatedHoursHundredths: 800,
      plannedCostCents: 40000,
    })
  })

  it('usa o padrão do usuário quando o envolvimento do Responsável está sem valor', () => {
    const current = planOf(task(1, { hours: 2, rateCents: 0 }), () => 3000, true)
    expect(current.plannedCostCents).toBe(6000)
  })

  it('custo nulo com o módulo cost desligado ou sem estimativa', () => {
    expect(
      planOf(task(1, { hours: 2, rateCents: 5000 }), () => 0, false).plannedCostCents,
    ).toBeNull()
    expect(planOf(task(1, { rateCents: 5000 }), () => 0, true).plannedCostCents).toBeNull()
    expect(planOf(task(1, { hours: 2, rateCents: 5000 }), () => 0, true).plannedCostCents).toBe(
      10000,
    )
  })
})

describe('isInComparison: quem entra na comparação', () => {
  const takenAt = '2026-11-02T12:00:00.000Z'
  it('tarefa da foto entra; tarefa criada depois entra; tarefa antiga sem datas na foto fica de fora', () => {
    const planned = new Set([toTaskId(id(1))])
    expect(
      isInComparison(
        { id: toTaskId(id(1)), createdAt: '2026-10-01T00:00:00.000Z' },
        planned,
        takenAt,
      ),
    ).toBe(true)
    expect(
      isInComparison(
        { id: toTaskId(id(2)), createdAt: '2026-11-03T00:00:00.000Z' },
        planned,
        takenAt,
      ),
    ).toBe(true)
    expect(
      isInComparison(
        { id: toTaskId(id(2)), createdAt: '2026-11-02T12:00:00.000Z' },
        planned,
        takenAt,
      ),
    ).toBe(false)
    expect(
      isInComparison(
        { id: toTaskId(id(2)), createdAt: '2026-10-01T00:00:00.000Z' },
        planned,
        takenAt,
      ),
    ).toBe(false)
  })
})

describe('hasPlanDates', () => {
  it('entra na foto com início ou fim, e fica de fora sem nenhum dos dois', () => {
    expect(hasPlanDates(plan(1, { starts: '2026-11-02' }))).toBe(true)
    expect(hasPlanDates(plan(1, { ends: '2026-11-02' }))).toBe(true)
    expect(hasPlanDates(plan(1))).toBe(false)
  })
})

describe('taskDeviation: desvio por tarefa', () => {
  it('fim depois do planejado é Atrasada, com os dias de atraso', () => {
    const deviation = taskDeviation(
      plan(1, { starts: '2026-11-02', ends: '2026-11-10' }),
      plan(1, { starts: '2026-11-02', ends: '2026-11-13' }),
    )
    expect(deviation).toMatchObject({
      status: 'late',
      delayDays: 3,
      startDelayDays: 0,
      endDelayDays: 3,
    })
  })

  it('início depois do planejado também é Atrasada, e o atraso é o maior dos dois', () => {
    const deviation = taskDeviation(
      plan(1, { starts: '2026-11-02', ends: '2026-11-10' }),
      plan(1, { starts: '2026-11-04', ends: '2026-11-10' }),
    )
    expect(deviation).toMatchObject({
      status: 'late',
      delayDays: 2,
      startDelayDays: 2,
      endDelayDays: 0,
    })
  })

  it('no dia ou adiantada é No prazo, e o atraso negativo aparece com sinal', () => {
    expect(
      taskDeviation(plan(1, { ends: '2026-11-10' }), plan(1, { ends: '2026-11-10' })),
    ).toMatchObject({ status: 'on_time', delayDays: 0 })
    expect(
      taskDeviation(plan(1, { ends: '2026-11-10' }), plan(1, { ends: '2026-11-08' })),
    ).toMatchObject({ status: 'on_time', delayDays: -2, endDelayDays: -2 })
  })

  it('sem data dos dois lados não há comparação de prazo', () => {
    const deviation = taskDeviation(plan(1), plan(1, { ends: '2026-11-10' }))
    expect(deviation).toMatchObject({ status: 'on_time', delayDays: null, endDelayDays: null })
  })

  it('diferença de horas e de custo, quando os dois lados existem', () => {
    const deviation = taskDeviation(
      plan(1, { hours: 8, cost: 40000 }),
      plan(1, { hours: 10, cost: 50000 }),
    )
    expect(deviation.hoursDeltaHundredths).toBe(200)
    expect(deviation.costDeltaCents).toBe(10000)
    expect(taskDeviation(plan(1), plan(1, { hours: 3 })).hoursDeltaHundredths).toBeNull()
  })

  it('tarefa que não estava na foto é Nova, sem comparação', () => {
    const deviation = taskDeviation(null, plan(2, { ends: '2026-11-10', hours: 4 }))
    expect(deviation).toMatchObject({
      status: 'new',
      delayDays: null,
      hoursDeltaHundredths: null,
      costDeltaCents: null,
    })
    expect(deviation.title).toBe('Tarefa 2')
  })

  it('tarefa da foto que sumiu do estado atual é Removida', () => {
    const deviation = taskDeviation(plan(3, { ends: '2026-11-10' }), null)
    expect(deviation).toMatchObject({ status: 'removed', delayDays: null, endDelayDays: null })
    expect(deviation.taskId).toBe(toTaskId(id(103)))
  })

  it('recusa a comparação sem nenhuma das duas tarefas', () => {
    expect(() => taskDeviation(null, null)).toThrow(ValidationError)
  })
})

describe('baselineSummary: fim, horas e custo do projeto', () => {
  it('fim planejado é o maior fim da foto; fim atual, o maior prazo atual; desvio em dias', () => {
    const summary = baselineSummary(
      [plan(1, { ends: '2026-11-10' }), plan(2, { ends: '2026-11-20' })],
      [
        plan(1, { ends: '2026-11-12' }),
        plan(2, { ends: '2026-11-18' }),
        plan(4, { ends: '2026-11-25' }),
      ],
    )
    expect(summary.plannedEnd).toBe('2026-11-20')
    expect(summary.currentEnd).toBe('2026-11-25')
    expect(summary.endDeviationDays).toBe(5)
  })

  it('o fim atual não conta tarefa arquivada (já fora da lista atual)', () => {
    const summary = baselineSummary([plan(1, { ends: '2026-11-10' })], [])
    expect(summary.currentEnd).toBeNull()
    expect(summary.endDeviationDays).toBeNull()
  })

  it('soma horas e custo da foto e do atual, ignorando o que é nulo', () => {
    const summary = baselineSummary(
      [plan(1, { hours: 8, cost: 40000 }), plan(2, { hours: null, cost: null })],
      [plan(1, { hours: 10, cost: 50000 }), plan(3, { hours: 2, cost: 10000 })],
    )
    expect(summary).toMatchObject({
      plannedHoursHundredths: 800,
      currentHoursHundredths: 1200,
      plannedCostCents: 40000,
      currentCostCents: 60000,
    })
  })

  it('projeto sem tarefas na foto: totais zerados e sem datas', () => {
    expect(baselineSummary([], [])).toEqual({
      plannedEnd: null,
      currentEnd: null,
      endDeviationDays: null,
      plannedHoursHundredths: 0,
      currentHoursHundredths: 0,
      plannedCostCents: null,
      currentCostCents: null,
    })
  })
})

describe('normalizeBaselineName', () => {
  it('tira as pontas e recusa vazio ou longo demais', () => {
    expect(normalizeBaselineName('  Contrato v1  ')).toBe('Contrato v1')
    expect(() => normalizeBaselineName('   ')).toThrow(ValidationError)
    expect(() => normalizeBaselineName('x'.repeat(BASELINE_NAME_MAX_LENGTH + 1))).toThrow(
      ValidationError,
    )
    expect(normalizeBaselineName('x'.repeat(BASELINE_NAME_MAX_LENGTH))).toHaveLength(
      BASELINE_NAME_MAX_LENGTH,
    )
  })
})
