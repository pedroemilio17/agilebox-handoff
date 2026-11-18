import { describe, expect, it } from 'vitest'
import { createDeliverable } from '../entities/deliverable'
import type { Deliverable } from '../entities/deliverable'
import { createMilestone } from '../entities/milestone'
import type { Milestone } from '../entities/milestone'
import {
  addParticipant,
  createTask,
  setEstimatedHours,
  setStatus,
  setTaskDeliverable,
} from '../entities/task'
import type { Task } from '../entities/task'
import { createParticipation } from '../entities/participation'
import {
  toDeliverableId,
  toMilestoneId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import type { DeliverableId } from '../shared/ids'
import { buildWbs } from './wbs'
import type { WbsDeliverableRow, WbsRow, WbsTaskRow } from './wbs'

const ulid = (n: number) => String(n).padStart(26, '0')
const at = '2026-03-01T10:00:00.000Z'
const org = toOrganizationId(ulid(1))
const project = toProjectId(ulid(2))
const ana = toUserId(ulid(3))
const did = (n: number): DeliverableId => toDeliverableId(ulid(100 + n))

/**
 * Árvore de três níveis:
 *   1 Fundação
 *     1.1 Infra (tem 2 tarefas)
 *       1.1.1 Banco (tem 1 tarefa)
 *     1.2 Acesso (sem tarefas)
 *   2 Relatórios (tem 1 tarefa)
 */
function deliverables(): Deliverable[] {
  const specs: Array<[number, number | null, string, number]> = [
    [1, null, 'Fundação', 0],
    [2, 1, 'Infra', 0],
    [3, 2, 'Banco', 0],
    [4, 1, 'Acesso', 1],
    [5, null, 'Relatórios', 1],
  ]
  const built: Deliverable[] = []
  for (const [id, parent, title, position] of specs) {
    built.push(
      createDeliverable(
        {
          id: did(id),
          organizationId: org,
          projectId: project,
          parentId: parent === null ? null : did(parent),
          title,
          position,
          createdBy: ana,
          createdAt: at,
        },
        built,
      ),
    )
  }
  return built
}

/** Tarefa com estimativa, status, entrega e apontamentos (horas × valor/hora de cada um). */
function task(
  n: number,
  deliverableId: number | null,
  options: {
    hours?: number | null
    status?: Task['status']
    archived?: boolean
    actual?: readonly { userId: string; hours: number; rate: number }[]
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
    responsibleRateCents: 1000,
    deliverableId: deliverableId === null ? null : did(deliverableId),
  })
  if (options.hours !== undefined) built = setEstimatedHours(built, options.hours)
  if (options.status !== undefined) built = setStatus(built, options.status)
  for (const [index, item] of (options.actual ?? []).entries()) {
    built = addParticipant(
      built,
      createParticipation({
        id: toParticipationId(ulid(400 + n * 10 + index)),
        taskId: built.id,
        participant: { kind: 'user', userId: toUserId(item.userId) },
        role: 'support',
        hoursHundredths: Math.round(item.hours * 100),
        rateCents: item.rate,
        addedAt: at,
      }),
    )
  }
  if (options.archived) built = { ...built, archivedAt: at, archivedBy: ana }
  return built
}

function milestone(n: number, deliverableId: number | null, dueOn: string): Milestone {
  return createMilestone({
    id: toMilestoneId(ulid(500 + n)),
    organizationId: org,
    projectId: project,
    title: `Marco ${n}`,
    dueOn,
    deliverableId: deliverableId === null ? null : did(deliverableId),
    criterion: null,
    createdBy: ana,
    createdAt: at,
  })
}

function deliverableRow(rows: readonly WbsRow[], n: number): WbsDeliverableRow {
  const row = rows.find(
    (item): item is WbsDeliverableRow =>
      item.kind === 'deliverable' && item.deliverable.id === did(n),
  )
  if (!row) throw new Error(`entrega ${n} não está na árvore`)
  return row
}

describe('leitura consolidada da EAP', () => {
  const tasks = [
    // Banco: 4 h estimadas e concluídas. Apontamentos: bia 2 h × 20,00 e carla 2 h × 10,00 = 60,00.
    task(1, 3, {
      hours: 4,
      status: 'done',
      actual: [
        { userId: ulid(4), hours: 2, rate: 2000 },
        { userId: ulid(5), hours: 2, rate: 1000 },
      ],
    }),
    // Infra: 2 h em andamento.
    task(2, 2, { hours: 2, status: 'in_progress' }),
    // Infra: sem estimativa, não soma horas nem progresso. Carla apontou 1 h × 10,00.
    task(3, 2, {
      hours: null,
      status: 'done',
      actual: [{ userId: ulid(5), hours: 1, rate: 1000 }],
    }),
    // Relatórios: 6 h, nada concluído.
    task(4, 5, { hours: 6, status: 'todo' }),
    // Sem entrega: entra no total do projeto, não em nenhuma entrega.
    task(5, null, { hours: 2, status: 'done' }),
    // Arquivada: fica de fora de tudo.
    task(6, 2, { hours: 9, status: 'done', archived: true }),
  ]

  it('soma horas, custo, progresso e contagem das subentregas para cima', () => {
    const tree = buildWbs({ deliverables: deliverables(), tasks, milestones: [] })

    // Fundação: Banco (4 h) + Infra (2 h) + Acesso (sem tarefas) = 6 h; concluídas 4 h → 67%.
    const root = deliverableRow(tree.rows, 1)
    expect(root.totals.hoursHundredths).toBe(600)
    expect(root.totals.progress).toBe(67)
    expect(root.totals.tasks).toBe(3)
    // Custo realizado: 2h×20 + 2h×10 + 1h×10 = 70,00 (em centavos: 7000).
    expect(root.totals.costCents).toBe(7000)

    // Infra: a própria (2 h em andamento, 1 h apontada sem estimativa) e o Banco (4 h concluídas).
    const infra = deliverableRow(tree.rows, 2)
    expect(infra.totals.hoursHundredths).toBe(600)
    expect(infra.totals.tasks).toBe(3)
    expect(infra.totals.progress).toBe(67)

    // Banco: só a tarefa concluída, 100%.
    expect(deliverableRow(tree.rows, 3).totals).toMatchObject({
      hoursHundredths: 400,
      progress: 100,
      tasks: 1,
      costCents: 6000,
    })
  })

  it('entrega sem horas tem progresso zero, e sem tarefas tem zero em tudo', () => {
    const tree = buildWbs({ deliverables: deliverables(), tasks: [], milestones: [] })
    expect(deliverableRow(tree.rows, 4).totals).toEqual({
      hoursHundredths: 0,
      costCents: 0,
      progress: 0,
      tasks: 0,
      milestones: [],
    })
  })

  it('o resumo do projeto conta tudo que está ativo, inclusive tarefas sem entrega', () => {
    const tree = buildWbs({ deliverables: deliverables(), tasks, milestones: [] })
    expect(tree.summary).toEqual({
      deliverables: 5,
      tasks: 5,
      hoursHundredths: 1400,
      costCents: 7000,
      progress: 43,
    })
    expect(tree.tasksWithoutDeliverable).toBe(1)
  })

  it('arquivada não entra nos totais nem na contagem', () => {
    const tree = buildWbs({ deliverables: deliverables(), tasks, milestones: [] })
    const archivedNumber = 6
    const everyTask = tree.rows.filter((row): row is WbsTaskRow => row.kind === 'task')
    expect(everyTask.map((row) => row.task.number)).not.toContain(archivedNumber)
  })

  it('ordena: cada entrega, depois as subentregas, depois as tarefas dela', () => {
    const tree = buildWbs({ deliverables: deliverables(), tasks, milestones: [] })
    const sequence = tree.rows.map((row) =>
      row.kind === 'deliverable' ? `E${row.deliverable.title}` : `T${row.task.number}`,
    )
    expect(sequence).toEqual([
      'EFundação',
      'EInfra',
      'EBanco',
      'T1',
      'T2',
      'T3',
      'EAcesso',
      'ERelatórios',
      'T4',
    ])
  })

  it('codifica a árvore e informa o nível (1 a 3)', () => {
    const tree = buildWbs({ deliverables: deliverables(), tasks, milestones: [] })
    const coded = tree.rows
      .filter((row): row is WbsDeliverableRow => row.kind === 'deliverable')
      .map((row) => [row.code, row.level, row.deliverable.title])
    expect(coded).toEqual([
      ['1', 1, 'Fundação'],
      ['1.1', 2, 'Infra'],
      ['1.1.1', 3, 'Banco'],
      ['1.2', 2, 'Acesso'],
      ['2', 1, 'Relatórios'],
    ])
  })

  it('marcos somam para cima: a entrega recebe os marcos das subentregas', () => {
    const milestones = [
      milestone(1, 3, '2026-06-01'),
      milestone(2, 1, '2026-09-01'),
      milestone(3, 5, '2026-07-01'),
      milestone(4, null, '2026-10-01'),
    ]
    const tree = buildWbs({ deliverables: deliverables(), tasks, milestones })
    expect(deliverableRow(tree.rows, 1).totals.milestones.map((item) => item.title)).toEqual([
      'Marco 1',
      'Marco 2',
    ])
    expect(deliverableRow(tree.rows, 3).totals.milestones.map((item) => item.title)).toEqual([
      'Marco 1',
    ])
    expect(deliverableRow(tree.rows, 4).totals.milestones).toEqual([])
  })

  it('o custo sai só dos apontamentos: tarefa sem horas apontadas custa zero', () => {
    const tree = buildWbs({
      deliverables: deliverables(),
      tasks: [task(9, 4, { hours: 8, status: 'todo' })],
      milestones: [],
    })
    expect(deliverableRow(tree.rows, 4).totals).toMatchObject({
      hoursHundredths: 800,
      costCents: 0,
    })
  })

  it('aponta a tarefa para uma entrega pelo domínio (setTaskDeliverable) e a leitura a reconhece', () => {
    const moved = setTaskDeliverable(task(7, null, { hours: 1 }), did(5))
    const tree = buildWbs({ deliverables: deliverables(), tasks: [moved], milestones: [] })
    expect(deliverableRow(tree.rows, 5).totals.tasks).toBe(1)
  })
})
