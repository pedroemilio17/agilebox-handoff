import type { SprintDto, TaskDto, WbsViewDto } from '@agilebox/contract'
import { deliverableRow, taskRow, wbsId, wbsView } from '../wbs/wbs-fixtures'
import type { SprintItemsById } from './plan-screen'

export const PLAN_PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
/** Hoje de teste: quarta, 18/11/2026, dentro da Sprint 2. */
export const PLAN_TODAY = '2026-11-18'

export const DELIVERABLE_1 = wbsId('101')
export const DELIVERABLE_2 = wbsId('102')
export const MILESTONE_1 = wbsId('201')
export const SPRINT_1 = wbsId('301')
export const SPRINT_2 = wbsId('302')
export const SPRINT_3 = wbsId('303')

export function sprintFixture(
  overrides: Partial<SprintDto> & Pick<SprintDto, 'id' | 'number'>,
): SprintDto {
  const status = overrides.status ?? 'draft'
  return {
    projectId: PLAN_PROJECT_ID,
    label: `Sprint ${overrides.number}`,
    name: `Sprint ${overrides.number}`,
    goal: null,
    plannedStart: '2026-11-03',
    plannedEnd: '2026-11-14',
    status,
    startedAt: null,
    closedAt: null,
    closePolicy: null,
    createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V09',
    createdAt: '2026-10-31T12:00:00.000Z',
    ...overrides,
  }
}

/** Tarefa de sprint (detalhe): só os campos que o plano e o quadro leem. */
export function sprintItem(
  id: string,
  options: {
    readonly deliverableId: string | null
    readonly status?: TaskDto['status']
    readonly estimatedHours?: number | null
    readonly title?: string
    readonly sprintId?: string
  },
): TaskDto {
  const status = options.status ?? 'todo'
  const number = Number(id.slice(-4)) || 1
  return {
    id,
    number,
    key: `AB-${number}`,
    projectId: PLAN_PROJECT_ID,
    projectName: 'Portal do Aluno',
    title: options.title ?? `Tarefa ${number}`,
    description: '',
    status,
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    checklistProgress: { done: 0, total: 0, percent: 0 },
    criteriaProgress: { done: 0, total: 0 },
    deliverableId: options.deliverableId,
    estimatedHours: options.estimatedHours ?? null,
    actualHours: 0,
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    sprint: options.sprintId
      ? { id: options.sprintId, number: 2, name: 'Sprint 2', status: 'active' }
      : null,
    commentCount: 0,
  }
}

/**
 * Projeto de exemplo, como a tela 17 do design: duas entregas, a primeira em andamento, três
 * sprints (fechada, ativa e planejada), um marco no fim da Sprint 2 e um item da Entrega 2 dentro da
 * Sprint 2 (fora da entrega que a sprint mostra).
 */
export function planExample(): {
  wbs: WbsViewDto
  sprints: SprintDto[]
  itemsById: SprintItemsById
} {
  const wbs: WbsViewDto = wbsView(
    [
      deliverableRow(DELIVERABLE_1, {
        code: '1',
        title: 'Acesso e perfil',
        progress: 58,
        hours: 22,
        milestones: [{ id: MILESTONE_1, title: 'Acesso no ar', dueOn: '2026-11-28' }],
      }),
      taskRow(wbsId('401'), DELIVERABLE_1, {
        status: 'done',
        estimatedHours: 8,
        title: 'Tela de login',
      }),
      taskRow(wbsId('402'), DELIVERABLE_1, {
        status: 'todo',
        estimatedHours: 6,
        title: 'Trocar a senha',
      }),
      taskRow(wbsId('403'), DELIVERABLE_1, {
        status: 'in_progress',
        estimatedHours: 8,
        title: 'Tela do perfil',
      }),
      taskRow(wbsId('404'), DELIVERABLE_1, {
        status: 'todo',
        estimatedHours: null,
        title: 'Termos',
      }),
      deliverableRow(DELIVERABLE_2, { code: '2', title: 'Matrícula online', progress: 0 }),
      taskRow(wbsId('405'), DELIVERABLE_2, {
        status: 'todo',
        estimatedHours: 5,
        title: 'Inscrição',
      }),
      taskRow(wbsId('406'), DELIVERABLE_2, {
        status: 'todo',
        estimatedHours: 3,
        title: 'Login Google',
      }),
    ],
    { canEdit: true },
  )
  // O marco fica também na lista de marcos do projeto (a EAP devolve os dois).
  wbs.milestones = [
    {
      id: MILESTONE_1,
      projectId: PLAN_PROJECT_ID,
      title: 'Acesso no ar',
      dueOn: '2026-11-28',
      deliverableId: DELIVERABLE_1,
      criterion: null,
      createdAt: '2026-10-31T12:00:00.000Z',
    },
  ]
  const sprints = [
    sprintFixture({
      id: SPRINT_1,
      number: 1,
      status: 'closed',
      plannedStart: '2026-11-03',
      plannedEnd: '2026-11-14',
    }),
    sprintFixture({
      id: SPRINT_2,
      number: 2,
      status: 'active',
      plannedStart: '2026-11-17',
      plannedEnd: '2026-11-28',
      goal: 'Aluno entra e edita o próprio perfil',
    }),
    sprintFixture({
      id: SPRINT_3,
      number: 3,
      status: 'draft',
      plannedStart: '2026-12-01',
      plannedEnd: '2026-12-12',
    }),
  ]
  const itemsById: SprintItemsById = {
    [SPRINT_1]: [
      sprintItem(wbsId('401'), {
        deliverableId: DELIVERABLE_1,
        status: 'done',
        estimatedHours: 8,
        title: 'Tela de login',
        sprintId: SPRINT_1,
      }),
    ],
    [SPRINT_2]: [
      sprintItem(wbsId('402'), {
        deliverableId: DELIVERABLE_1,
        estimatedHours: 6,
        title: 'Trocar a senha',
        sprintId: SPRINT_2,
      }),
      sprintItem(wbsId('403'), {
        deliverableId: DELIVERABLE_1,
        status: 'in_progress',
        estimatedHours: 8,
        title: 'Tela do perfil',
        sprintId: SPRINT_2,
      }),
      sprintItem(wbsId('406'), {
        deliverableId: DELIVERABLE_2,
        estimatedHours: 3,
        title: 'Login Google',
        sprintId: SPRINT_2,
      }),
    ],
    [SPRINT_3]: [
      sprintItem(wbsId('405'), {
        deliverableId: DELIVERABLE_2,
        estimatedHours: 5,
        title: 'Inscrição',
      }),
    ],
  }
  return { wbs, sprints, itemsById }
}
