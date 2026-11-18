import { describe, expect, it } from 'vitest'
import {
  archiveTask,
  addParticipant,
  createTask,
  setDeadline,
  setEstimatedHours,
  setStatus,
  setTaskDeliverable,
  setTaskStart,
} from '../entities/task'
import type { Task } from '../entities/task'
import { createParticipation } from '../entities/participation'
import type { Deliverable } from '../entities/deliverable'
import { createDeliverable } from '../entities/deliverable'
import {
  toDeliverableId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import type { DeliverableId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import {
  deliverableSubtree,
  hasScopeConflict,
  milestoneStatus,
  nextMilestone,
  progressPercent,
  trackingTotals,
  weekOf,
} from './tracking'
import type { MilestoneScopeTask } from './tracking'

const ulid = (n: number) => String(n).padStart(26, '0')
const at = '2026-03-01T10:00:00.000Z'
const org = toOrganizationId(ulid(1))
const project = toProjectId(ulid(2))
const ana = toUserId(ulid(3))
const bia = toUserId(ulid(4))
const day = (value: string): DateOnly => parseDateOnly(value)
const did = (n: number): DeliverableId => toDeliverableId(ulid(100 + n))

/** Tarefa mínima: responsável Ana com valor/hora `rate` (0 = usa o padrão). */
function task(
  n: number,
  options: {
    status?: Task['status']
    deadline?: string | null
    startsOn?: string | null
    hours?: number | null
    deliverable?: number | null
    archived?: boolean
    rate?: number
    apontamentos?: readonly { userId: string; hundredths: number; rate: number }[]
  } = {},
): Task {
  let built = createTask({
    id: toTaskId(ulid(200 + n)),
    organizationId: org,
    number: n,
    projectId: project,
    projectName: 'Projeto',
    createdBy: ana,
    title: `Tarefa ${n}`,
    createdAt: at,
    responsibleParticipationId: toParticipationId(ulid(300 + n)),
    responsibleRateCents: options.rate ?? 0,
  })
  if (options.status) built = setStatus(built, options.status)
  if (options.deadline !== undefined)
    built = setDeadline(built, options.deadline === null ? null : day(options.deadline))
  if (options.startsOn !== undefined)
    built = setTaskStart(built, options.startsOn === null ? null : day(options.startsOn))
  if (options.hours !== undefined) built = setEstimatedHours(built, options.hours)
  if (options.deliverable !== undefined)
    built = setTaskDeliverable(
      built,
      options.deliverable === null ? null : did(options.deliverable),
    )
  for (const [index, item] of (options.apontamentos ?? []).entries()) {
    built = addParticipant(
      built,
      createParticipation({
        id: toParticipationId(ulid(400 + n * 10 + index)),
        taskId: built.id,
        participant: { kind: 'user', userId: toUserId(item.userId) },
        role: 'support',
        hoursHundredths: item.hundredths,
        rateCents: item.rate,
        addedAt: at,
      }),
    )
  }
  if (options.archived) built = archiveTask(built, ana, at)
  return built
}

function scopeOf(tasks: readonly Task[]): MilestoneScopeTask[] {
  return tasks.map((item) => ({
    id: item.id,
    status: item.status,
    deadline: item.deadline,
    archivedAt: item.archivedAt,
  }))
}

const TODAY = day('2026-06-10')

describe('milestoneStatus', () => {
  it('sem entrega ligada: nunca é cumprido; em risco só quando a data já passou', () => {
    const base = { dueOn: day('2026-06-20'), today: TODAY, dependencies: [], tasks: [] }
    expect(milestoneStatus({ ...base, scope: null })).toBe('on_track')
    expect(milestoneStatus({ ...base, dueOn: day('2026-06-01'), scope: null })).toBe('at_risk')
  })

  it('data de hoje ainda não está atrasada; ontem já passou', () => {
    const base = { dueOn: TODAY, today: TODAY, scope: null, dependencies: [], tasks: [] }
    expect(milestoneStatus(base)).toBe('on_track')
    expect(milestoneStatus({ ...base, dueOn: day('2026-06-09') })).toBe('at_risk')
  })

  it('com entrega: cumprido quando todas as tarefas ativas estão concluídas (mesmo com a data passada)', () => {
    const tasks = [task(1, { status: 'done' }), task(2, { status: 'done' })]
    const status = milestoneStatus({
      dueOn: day('2026-06-01'),
      today: TODAY,
      scope: scopeOf(tasks),
      dependencies: [],
      tasks,
    })
    expect(status).toBe('done')
  })

  it('com entrega sem nenhuma tarefa ativa: não é cumprido, e só fica em risco se a data passou', () => {
    const archived = task(1, { status: 'done', archived: true })
    const scope = scopeOf([archived])
    const base = { scope, dependencies: [], tasks: [archived] }
    expect(milestoneStatus({ ...base, dueOn: day('2026-06-20'), today: TODAY })).toBe('on_track')
    expect(milestoneStatus({ ...base, dueOn: day('2026-06-01'), today: TODAY })).toBe('at_risk')
    expect(milestoneStatus({ ...base, dueOn: day('2026-06-20'), today: TODAY, scope: [] })).toBe(
      'on_track',
    )
  })

  it('tarefa arquivada aberta não impede o cumprido', () => {
    const tasks = [task(1, { status: 'done' }), task(2, { status: 'todo', archived: true })]
    expect(
      milestoneStatus({
        dueOn: day('2026-06-20'),
        today: TODAY,
        scope: scopeOf(tasks),
        dependencies: [],
        tasks,
      }),
    ).toBe('done')
  })

  it('tarefa aberta com prazo depois da data do marco deixa em risco; prazo no próprio dia não', () => {
    const late = [task(1, { status: 'in_progress', deadline: '2026-06-21' })]
    const onTheDay = [task(1, { status: 'in_progress', deadline: '2026-06-20' })]
    const noDeadline = [task(1, { status: 'in_progress', deadline: null })]
    const args = { dueOn: day('2026-06-20'), today: TODAY, dependencies: [] }
    expect(milestoneStatus({ ...args, scope: scopeOf(late), tasks: late })).toBe('at_risk')
    expect(milestoneStatus({ ...args, scope: scopeOf(onTheDay), tasks: onTheDay })).toBe('on_track')
    expect(milestoneStatus({ ...args, scope: scopeOf(noDeadline), tasks: noDeadline })).toBe(
      'on_track',
    )
  })

  it('tarefa concluída com prazo depois da data não conta como risco', () => {
    const tasks = [
      task(1, { status: 'done', deadline: '2026-07-30' }),
      task(2, { status: 'todo', deadline: '2026-06-01' }),
    ]
    expect(
      milestoneStatus({
        dueOn: day('2026-06-20'),
        today: TODAY,
        scope: scopeOf(tasks),
        dependencies: [],
        tasks,
      }),
    ).toBe('on_track')
  })

  it('dependência em conflito entre duas tarefas do escopo deixa em risco', () => {
    const pred = task(1, { status: 'in_progress', deadline: '2026-06-25' })
    const succ = task(2, { status: 'todo', startsOn: '2026-06-22', deadline: '2026-06-30' })
    const outside = task(3, { status: 'todo', startsOn: '2026-06-01' })
    const dependencies = [{ predecessorId: pred.id, successorId: succ.id }]
    const args = { dueOn: day('2026-06-30'), today: TODAY, dependencies }
    expect(milestoneStatus({ ...args, scope: scopeOf([pred, succ]), tasks: [pred, succ] })).toBe(
      'at_risk',
    )
    // Quando a sucessora está fora do escopo, o conflito não é da entrega.
    expect(
      milestoneStatus({ ...args, scope: scopeOf([pred, outside]), tasks: [pred, outside, succ] }),
    ).toBe('on_track')
  })

  it('cumprido vence o conflito e o prazo', () => {
    const pred = task(1, { status: 'done', deadline: '2026-06-25' })
    const succ = task(2, { status: 'done', startsOn: '2026-06-01', deadline: '2026-07-30' })
    expect(
      milestoneStatus({
        dueOn: day('2026-06-20'),
        today: TODAY,
        scope: scopeOf([pred, succ]),
        dependencies: [{ predecessorId: pred.id, successorId: succ.id }],
        tasks: [pred, succ],
      }),
    ).toBe('done')
  })
})

describe('hasScopeConflict', () => {
  it('só olha as dependências com as duas pontas no escopo e datas preenchidas', () => {
    const pred = task(1, { deadline: '2026-06-25' })
    const succ = task(2, { startsOn: '2026-06-20' })
    const deps = [{ predecessorId: pred.id, successorId: succ.id }]
    expect(hasScopeConflict([pred, succ], deps, [pred, succ])).toBe(true)
    expect(hasScopeConflict([pred], deps, [pred, succ])).toBe(false)
    const noStart = task(3, { startsOn: null })
    expect(
      hasScopeConflict(
        [pred, noStart],
        [{ predecessorId: pred.id, successorId: noStart.id }],
        [pred, noStart],
      ),
    ).toBe(false)
  })
})

describe('deliverableSubtree', () => {
  it('reúne a entrega e as subentregas em qualquer nível, sem laço', () => {
    const items = [
      { id: did(1), parentId: null },
      { id: did(2), parentId: did(1) },
      { id: did(3), parentId: did(2) },
      { id: did(4), parentId: null },
      // Dado corrompido: entrega 5 aponta para ela mesma.
      { id: did(5), parentId: did(5) },
    ] as Pick<Deliverable, 'id' | 'parentId'>[]
    expect([...deliverableSubtree(did(1), items)].sort()).toEqual([did(1), did(2), did(3)].sort())
    expect([...deliverableSubtree(did(4), items)]).toEqual([did(4)])
  })

  it('uma entrega sem filhas forma só a própria subárvore', () => {
    const root = createDeliverable(
      {
        id: did(1),
        organizationId: org,
        projectId: project,
        parentId: null,
        title: 'Raiz',
        position: 0,
        createdBy: ana,
        createdAt: at,
      },
      [],
    )
    expect(deliverableSubtree(root.id, [root])).toEqual(new Set([root.id]))
  })
})

describe('weekOf', () => {
  const range = { start: day('2026-04-01'), end: day('2026-04-30') }

  it('sem intervalo não há semana', () => {
    expect(weekOf(null, TODAY)).toBeNull()
  })

  it('conta as semanas de calendário cobertas pelo intervalo, início e fim incluídos', () => {
    expect(weekOf(range, day('2026-04-01'))).toEqual({ current: 1, total: 5 })
    expect(weekOf({ start: day('2026-04-01'), end: day('2026-04-01') }, TODAY)).toEqual({
      current: 1,
      total: 1,
    })
  })

  it('avança a cada sete dias e fica entre 1 e o total', () => {
    expect(weekOf(range, day('2026-04-07'))).toEqual({ current: 1, total: 5 })
    expect(weekOf(range, day('2026-04-08'))).toEqual({ current: 2, total: 5 })
    expect(weekOf(range, day('2026-03-20'))).toEqual({ current: 1, total: 5 })
    expect(weekOf(range, day('2026-05-20'))).toEqual({ current: 5, total: 5 })
  })
})

describe('nextMilestone', () => {
  const m = (id: string, dueOn: string, status: 'done' | 'at_risk' | 'on_track') => ({
    id,
    dueOn: day(dueOn),
    status,
  })

  it('pega o de data mais próxima a partir de hoje, sem os cumpridos nem os passados', () => {
    const list = [
      m('passado', '2026-06-01', 'on_track'),
      m('cumprido', '2026-06-11', 'done'),
      m('hoje', '2026-06-10', 'on_track'),
      m('depois', '2026-07-01', 'at_risk'),
    ]
    expect(nextMilestone(list, TODAY)?.id).toBe('hoje')
  })

  it('nulo quando não há marco pela frente', () => {
    expect(
      nextMilestone([m('a', '2026-06-01', 'at_risk'), m('b', '2026-06-20', 'done')], TODAY),
    ).toBeNull()
    expect(nextMilestone([], TODAY)).toBeNull()
  })
})

describe('progressPercent', () => {
  it('é zero sem horas e arredonda para inteiro', () => {
    expect(progressPercent(0, 0)).toBe(0)
    expect(progressPercent(100, 300)).toBe(33)
    expect(progressPercent(200, 300)).toBe(67)
    expect(progressPercent(300, 300)).toBe(100)
  })
})

describe('trackingTotals', () => {
  const rateOf = (userId: string) => (userId === ana ? 5000 : 3000)

  it('soma horas previstas, apontadas, custo realizado e a concluída pelas horas estimadas', () => {
    const tasks = [
      task(1, {
        status: 'done',
        hours: 10,
        apontamentos: [{ userId: bia, hundredths: 200, rate: 3000 }],
      }),
      task(2, {
        status: 'in_progress',
        hours: 30,
        apontamentos: [{ userId: bia, hundredths: 100, rate: 3000 }],
      }),
    ]
    const totals = trackingTotals(tasks, rateOf)
    expect(totals.plannedHoursHundredths).toBe(4000)
    expect(totals.loggedHoursHundredths).toBe(300)
    expect(totals.realizedCostCents).toBe(6000 + 3000)
    expect(totals.progress).toBe(25)
    expect(totals.tasks).toEqual({ total: 2, done: 1 })
  })

  it('ignora tarefas arquivadas em tudo', () => {
    const tasks = [
      task(1, { status: 'done', hours: 10 }),
      task(2, {
        status: 'todo',
        hours: 90,
        archived: true,
        apontamentos: [{ userId: bia, hundredths: 500, rate: 3000 }],
      }),
    ]
    const totals = trackingTotals(tasks, rateOf)
    expect(totals.plannedHoursHundredths).toBe(1000)
    expect(totals.loggedHoursHundredths).toBe(0)
    expect(totals.realizedCostCents).toBe(0)
    expect(totals.progress).toBe(100)
    expect(totals.tasks).toEqual({ total: 1, done: 1 })
  })

  it('custo previsto usa o valor/hora do Responsável ou o padrão dele, e pula o que não tem base', () => {
    const tasks = [
      // Sem valor no envolvimento: cai no padrão da Ana (50,00). 10 h × 50,00 = 500,00.
      task(1, { hours: 10, rate: 0 }),
      // Com valor no envolvimento: 4 h × 60,00 = 240,00.
      task(2, { hours: 4, rate: 6000 }),
      // Sem estimativa: não entra.
      task(3, { hours: null, rate: 6000 }),
    ]
    expect(trackingTotals(tasks, rateOf).plannedCostCents).toBe(50_000 + 24_000)
  })

  it('zera o progresso e os totais sem tarefas', () => {
    expect(trackingTotals([], rateOf)).toEqual({
      progress: 0,
      plannedHoursHundredths: 0,
      loggedHoursHundredths: 0,
      realizedCostCents: 0,
      plannedCostCents: 0,
      tasks: { total: 0, done: 0 },
    })
  })
})
