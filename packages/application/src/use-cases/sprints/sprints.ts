import {
  addTaskToSprint,
  BACKLOG_RANK_GAP,
  canPlanSprint,
  canStartOrCloseSprint,
  canViewSprints,
  ConflictError,
  createSprint,
  createTimelineEvent,
  formatTaskKey,
  isInBacklog,
  isManagerEdit,
  moduleStateOf,
  NotFoundError,
  PermissionDeniedError,
  planSprintClose,
  planSprintDiscard,
  pullFromBacklog,
  rankAtEnd,
  readSprintsMaxActive,
  removeTaskFromSprint,
  sendToBacklog,
  startSprint,
  toEventId,
  toProjectId,
  toSprintId,
  toTaskId,
  updateSprint,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  Project,
  ProjectId,
  Sprint,
  SprintClosePolicy,
  SprintId,
  SprintTask,
  Task,
  TaskId,
  TaskTimelineDraft,
  TeamToolsSettings,
  TimelineEvent,
} from '@agilebox/core'
import type {
  CloseSprintInput,
  CreateSprintInput,
  DiscardSprintInput,
  ListSprintsInput,
  SprintDetailDto,
  SprintDto,
  UpdateSprintInput,
} from '@agilebox/contract'
import { toSprintDto, toSprintHistoryRowDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import type { UnitOfWorkRepositories } from '../../ports'
import { findTaskPrefix } from '../tasks/task-prefix'
import { toTaskDtos } from '../tasks/list-tasks'
import { recordGuideEvent } from '../guide/record-guide-event'

type Repositories = UnitOfWorkRepositories
type ProjectPolicy = (actor: Actor, project: Project, isMember: boolean) => boolean

/** Projeto da sprint e a permissão da ação (membro ou gestor, vinda do domínio). */
async function projectFor(
  deps: Pick<AppDeps, 'projects'>,
  actor: Actor,
  projectId: ProjectId,
  allowed: ProjectPolicy,
  denied: string,
): Promise<Project> {
  const project = await deps.projects.findById(actor.organizationId, projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  const members = await deps.projects.listMembers(actor.organizationId, projectId)
  if (
    !allowed(
      actor,
      project,
      members.some((member) => member.userId === actor.userId),
    )
  )
    throw new PermissionDeniedError(denied)
  return project
}

const PLANNING_DENIED = 'Sem permissão para planejar sprints deste projeto'
const VIEW_DENIED = 'Sem acesso às sprints deste projeto'

async function requireSprint(
  repos: Pick<Repositories, 'sprints'>,
  organizationId: Actor['organizationId'],
  sprintId: string,
): Promise<Sprint> {
  const sprint = await repos.sprints.findById(organizationId, toSprintId(sprintId))
  if (!sprint) throw new NotFoundError('Sprint não encontrada')
  return sprint
}

/** Sprint e projeto para a leitura ou a ação, com a permissão aplicada antes de qualquer gravação. */
async function sprintScope(
  deps: AppDeps,
  actor: Actor,
  sprintId: string,
  allowed: ProjectPolicy,
  denied: string,
): Promise<Sprint> {
  const sprint = await deps.sprints.findById(actor.organizationId, toSprintId(sprintId))
  if (!sprint) throw new NotFoundError('Sprint não encontrada')
  await projectFor(deps, actor, sprint.projectId, allowed, denied)
  return sprint
}

function sprintConfigOf(settings: TeamToolsSettings): number {
  return readSprintsMaxActive(
    settings.modules.find((module) => module.moduleId === 'sprints')?.config,
  )
}

function isOpen(row: Pick<SprintTask, 'removedAt'>): boolean {
  return row.removedAt === null
}

/** Eventos de linha do tempo a partir dos rascunhos do domínio, com id e autoria do ator. */
async function toEvents(
  deps: Pick<AppDeps, 'idGenerator'>,
  actor: Actor,
  at: string,
  drafts: readonly TaskTimelineDraft[],
): Promise<TimelineEvent[]> {
  return Promise.all(
    drafts.map(async ({ taskId, draft }) =>
      createTimelineEvent({
        ...draft,
        id: toEventId(await deps.idGenerator.generate(actor.organizationId)),
        taskId,
        at,
        actorUserId: actor.userId,
        asManager: isManagerEdit(actor),
      }),
    ),
  )
}

/** Evento de puxar do backlog para o quadro: a mesma regra e o mesmo evento de `backlog.pull`. */
async function pullEvent(
  deps: Pick<AppDeps, 'idGenerator'>,
  actor: Actor,
  at: string,
  taskId: TaskId,
): Promise<TimelineEvent> {
  return createTimelineEvent({
    id: toEventId(await deps.idGenerator.generate(actor.organizationId)),
    taskId,
    at,
    actorUserId: actor.userId,
    asManager: isManagerEdit(actor),
    type: 'task_pulled_from_backlog',
    payload: { status: 'todo' },
  })
}

async function sentToBacklogEvent(
  deps: Pick<AppDeps, 'idGenerator'>,
  actor: Actor,
  at: string,
  taskId: TaskId,
): Promise<TimelineEvent> {
  return createTimelineEvent({
    id: toEventId(await deps.idGenerator.generate(actor.organizationId)),
    taskId,
    at,
    actorUserId: actor.userId,
    asManager: isManagerEdit(actor),
    type: 'task_sent_to_backlog',
    payload: {},
  })
}

/**
 * Posições para devolver tarefas ao fim do backlog, em sequência. Calculado uma vez por gravação:
 * a primeira vaga fica depois do último item e cada uma seguinte, um espaço depois.
 */
function backlogEndSequence(lastRank: number): () => number {
  let next = lastRank
  return () => {
    const rank = next
    next += BACKLOG_RANK_GAP
    return rank
  }
}

async function loadTasks(
  repos: Pick<Repositories, 'tasks'>,
  organizationId: Actor['organizationId'],
  taskIds: readonly TaskId[],
): Promise<Map<TaskId, Task>> {
  const tasks = new Map<TaskId, Task>()
  for (const taskId of new Set(taskIds)) {
    const task = await repos.tasks.findById(organizationId, taskId)
    if (task) tasks.set(taskId, task)
  }
  return tasks
}

/**
 * Detalhe da sprint: os itens que estão nela agora (DTO de tarefa, com a sprint de cada um) e o
 * histórico completo, com as linhas já fechadas. Nada do histórico some.
 */
async function detailOf(deps: AppDeps, actor: Actor, sprint: Sprint): Promise<SprintDetailDto> {
  const organizationId = actor.organizationId
  const rows = await deps.sprintTasks.listBySprint(organizationId, sprint.id)
  const tasks = await loadTasks(
    deps,
    organizationId,
    rows.map((row) => row.taskId),
  )
  const prefix = await findTaskPrefix(deps, organizationId)
  const items = await toTaskDtos(
    deps,
    actor,
    rows.filter(isOpen).flatMap((row) => {
      const task = tasks.get(row.taskId)
      return task ? [task] : []
    }),
    prefix,
  )
  const history = rows.flatMap((row) => {
    const task = tasks.get(row.taskId)
    return task
      ? [toSprintHistoryRowDto(row, { key: formatTaskKey(prefix, task.number), title: task.title })]
      : []
  })
  return { sprint: toSprintDto(sprint), items: [...items], history }
}

async function reloadDetail(
  deps: AppDeps,
  actor: Actor,
  sprintId: SprintId,
): Promise<SprintDetailDto> {
  const sprint = await deps.sprints.findById(actor.organizationId, sprintId)
  if (!sprint) throw new NotFoundError('Sprint não encontrada')
  return detailOf(deps, actor, sprint)
}

/** Sprints do projeto (M4.2), sem as descartadas. Membros e gestor veem; o filtro de estado é opcional. */
export class ListSprints {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ListSprintsInput): Promise<readonly SprintDto[]> {
    const projectId = toProjectId(input.projectId)
    await projectFor(this.deps, actor, projectId, canViewSprints, VIEW_DENIED)
    const sprints = await this.deps.sprints.listByProject(
      actor.organizationId,
      projectId,
      input.status,
    )
    return sprints.map(toSprintDto)
  }
}

export class GetSprint {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly sprintId: string }): Promise<SprintDetailDto> {
    const sprint = await sprintScope(this.deps, actor, input.sprintId, canViewSprints, VIEW_DENIED)
    return detailOf(this.deps, actor, sprint)
  }
}

/**
 * Cria sprint em rascunho. Número sequencial por projeto (as descartadas contam, para o número não
 * ser reaproveitado). Projeto arquivado não aceita sprint nova.
 */
export class CreateSprint {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: CreateSprintInput): Promise<SprintDetailDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await projectFor(this.deps, actor, projectId, canPlanSprint, PLANNING_DENIED)
    if (project.archivedAt !== null)
      throw new ConflictError('Projeto arquivado não aceita sprint nova')
    const now = await this.deps.clock.now(organizationId)
    const sprint = await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const created = createSprint({
        id: toSprintId(await this.deps.idGenerator.generate(organizationId)),
        organizationId,
        projectId,
        number: await repos.sprints.nextNumber(organizationId, projectId),
        name: input.name ?? '',
        goal: input.goal ?? null,
        plannedStart: input.plannedStart,
        plannedEnd: input.plannedEnd,
        createdBy: actor.userId,
        createdAt: now,
      })
      await repos.sprints.save(organizationId, created)
      await recordGuideEvent(repos, actor, projectId, 'sprint.created', now)
      return created
    })
    return detailOf(this.deps, actor, sprint)
  }
}

/** Edita nome, meta e datas. Rascunho e ativa; encerrada é só leitura (regra do domínio). */
export class UpdateSprint {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: UpdateSprintInput): Promise<SprintDetailDto> {
    const organizationId = actor.organizationId
    await sprintScope(this.deps, actor, input.sprintId, canPlanSprint, PLANNING_DENIED)
    await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const sprint = await requireSprint(repos, organizationId, input.sprintId)
      const updated = updateSprint(sprint, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        ...(input.plannedStart !== undefined ? { plannedStart: input.plannedStart } : {}),
        ...(input.plannedEnd !== undefined ? { plannedEnd: input.plannedEnd } : {}),
      })
      if (updated !== sprint) await repos.sprints.save(organizationId, updated)
    })
    return reloadDetail(this.deps, actor, toSprintId(input.sprintId))
  }
}

/**
 * Inicia a sprint (rascunho → ativa). Vale o limite de sprints ativas do projeto, lido da
 * configuração do módulo na equipe (ADR-08). Os itens de backlog da sprint vão para o quadro, em A
 * fazer, com o mesmo evento de `backlog.pull`.
 */
export class StartSprint {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly sprintId: string }): Promise<SprintDetailDto> {
    const organizationId = actor.organizationId
    await sprintScope(this.deps, actor, input.sprintId, canStartOrCloseSprint, PLANNING_DENIED)
    const now = await this.deps.clock.now(organizationId)
    const pulled = await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const sprint = await requireSprint(repos, organizationId, input.sprintId)
      const settings = await repos.teamTools.getSettings(organizationId)
      const started = startSprint(
        sprint,
        now,
        await repos.sprints.countActive(organizationId, sprint.projectId),
        sprintConfigOf(settings),
      )
      const events: TimelineEvent[] = []
      const changed: TaskId[] = []
      const rows = (await repos.sprintTasks.listBySprint(organizationId, sprint.id)).filter(isOpen)
      for (const task of (
        await loadTasks(
          repos,
          organizationId,
          rows.map((row) => row.taskId),
        )
      ).values()) {
        if (task.archivedAt !== null || !isInBacklog(task)) continue
        await repos.tasks.save(organizationId, pullFromBacklog(task, 'todo'))
        events.push(await pullEvent(this.deps, actor, now, task.id))
        changed.push(task.id)
      }
      await repos.sprints.save(organizationId, started)
      if (events.length > 0) await repos.timeline.saveMany(organizationId, events)
      return changed
    })
    await this.publish(actor, pulled)
    return reloadDetail(this.deps, actor, toSprintId(input.sprintId))
  }

  private async publish(actor: Actor, changed: readonly TaskId[]): Promise<void> {
    if (changed.length > 0)
      await this.deps.changeNotifier.publish(actor.organizationId, {
        kind: 'task',
        ids: [...changed],
      })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'board', ids: [] })
  }
}

/**
 * Encerra a sprint ativa (decisão A). Itens concluídos ficam concluídos; arquivados saem sem mudar de
 * lugar; levados (`carry_over`) vão para a sprint seguinte; os não iniciados voltam ao backlog; os já
 * iniciados ficam no quadro, sem sprint. Tudo numa transação: sprint, histórico e devoluções.
 */
export class CloseSprint {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: CloseSprintInput): Promise<SprintDetailDto> {
    const organizationId = actor.organizationId
    await sprintScope(this.deps, actor, input.sprintId, canStartOrCloseSprint, PLANNING_DENIED)
    if (input.policy === 'carry_over' && input.nextSprintId === undefined)
      throw new ValidationError('Escolha a sprint seguinte para levar os itens abertos')
    const now = await this.deps.clock.now(organizationId)
    const changed = await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const sprint = await requireSprint(repos, organizationId, input.sprintId)
      const policy: SprintClosePolicy =
        input.policy === 'carry_over' && input.nextSprintId !== undefined
          ? { kind: 'carry_over', nextSprintId: toSprintId(input.nextSprintId) }
          : { kind: 'return_to_backlog' }
      // Levar os itens cria linhas novas na sprint seguinte: o módulo em encerramento não cria.
      // O estado é o do projeto da sprint (ADR-10).
      const projectRows =
        policy.kind === 'carry_over'
          ? await repos.projectModules.list(organizationId, sprint.projectId)
          : []
      if (policy.kind === 'carry_over' && moduleStateOf(projectRows, 'sprints') === 'winding_down')
        throw new ConflictError(
          'Sprints está sendo encerrada: os itens abertos voltam ao backlog ou ficam no quadro',
        )
      const nextSprint =
        policy.kind === 'carry_over'
          ? await requireSprint(repos, organizationId, policy.nextSprintId)
          : undefined
      const rows = await repos.sprintTasks.listBySprint(organizationId, sprint.id)
      const tasks = await loadTasks(
        repos,
        organizationId,
        rows.filter(isOpen).map((row) => row.taskId),
      )
      const plan = planSprintClose({
        sprint,
        rows,
        tasks: [...tasks.values()].map((task) => ({
          id: task.id,
          status: task.status,
          archivedAt: task.archivedAt,
        })),
        policy,
        ...(nextSprint !== undefined ? { nextSprint } : {}),
        at: now,
        actor,
      })
      await repos.sprints.save(organizationId, plan.sprint)
      await repos.sprintTasks.saveRows(organizationId, [...plan.rows, ...plan.newRows])

      const nextRank = backlogEndSequence(
        rankAtEnd(await repos.tasks.listBacklog(organizationId, sprint.projectId)),
      )
      const changedTasks: TaskId[] = []
      const events: TimelineEvent[] = []
      for (const taskId of plan.returnToBacklog) {
        const task = tasks.get(taskId)
        if (!task || isInBacklog(task)) continue
        await repos.tasks.save(organizationId, sendToBacklog(task, nextRank()))
        events.push(await sentToBacklogEvent(this.deps, actor, now, taskId))
        changedTasks.push(taskId)
      }
      events.push(...(await toEvents(this.deps, actor, now, plan.timeline)))
      if (events.length > 0) await repos.timeline.saveMany(organizationId, events)
      return changedTasks
    })
    await this.publish(actor, changed)
    return reloadDetail(this.deps, actor, toSprintId(input.sprintId))
  }

  private async publish(actor: Actor, changed: readonly TaskId[]): Promise<void> {
    if (changed.length > 0)
      await this.deps.changeNotifier.publish(actor.organizationId, {
        kind: 'task',
        ids: [...changed],
      })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'board', ids: [] })
  }
}

/**
 * Descarte lógico de rascunho (decisão B): a linha da sprint fica, marcada, e as de histórico se
 * fecham. Com itens abertos, só com `returnToBacklog`: os não iniciados voltam ao backlog, os já
 * iniciados ficam no quadro e os arquivados saem.
 */
export class DiscardSprint {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: DiscardSprintInput): Promise<{ readonly sprintId: string }> {
    const organizationId = actor.organizationId
    await sprintScope(this.deps, actor, input.sprintId, canPlanSprint, PLANNING_DENIED)
    const now = await this.deps.clock.now(organizationId)
    const changed = await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const sprint = await requireSprint(repos, organizationId, input.sprintId)
      const rows = await repos.sprintTasks.listBySprint(organizationId, sprint.id)
      const tasks = await loadTasks(
        repos,
        organizationId,
        rows.filter(isOpen).map((row) => row.taskId),
      )
      const plan = planSprintDiscard({
        sprint,
        rows,
        tasks: [...tasks.values()].map((task) => ({
          id: task.id,
          status: task.status,
          archivedAt: task.archivedAt,
        })),
        returnToBacklog: input.returnToBacklog === true,
        at: now,
        actor,
      })
      await repos.sprintTasks.saveRows(organizationId, plan.rows)
      const nextRank = backlogEndSequence(
        rankAtEnd(await repos.tasks.listBacklog(organizationId, sprint.projectId)),
      )
      const changedTasks: TaskId[] = []
      const events: TimelineEvent[] = []
      for (const taskId of plan.returnToBacklog) {
        const task = tasks.get(taskId)
        if (!task || isInBacklog(task)) continue
        await repos.tasks.save(organizationId, sendToBacklog(task, nextRank()))
        events.push(await sentToBacklogEvent(this.deps, actor, now, taskId))
        changedTasks.push(taskId)
      }
      events.push(...(await toEvents(this.deps, actor, now, plan.timeline)))
      if (events.length > 0) await repos.timeline.saveMany(organizationId, events)
      await repos.sprints.markDiscarded(organizationId, sprint.id, now, actor.userId)
      return changedTasks
    })
    if (changed.length > 0)
      await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: [...changed] })
    await this.deps.changeNotifier.publish(organizationId, { kind: 'board', ids: [] })
    return { sprintId: input.sprintId }
  }
}

/**
 * Adiciona um item à sprint. Não move o item de backlog (decisão C), exceto quando a sprint já está
 * ativa: aí o item vai para o quadro na hora. Uma tarefa só está em uma sprint aberta por vez.
 */
export class AddSprintTask {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly sprintId: string; readonly taskId: string },
  ): Promise<SprintDetailDto> {
    const organizationId = actor.organizationId
    await sprintScope(this.deps, actor, input.sprintId, canPlanSprint, PLANNING_DENIED)
    const now = await this.deps.clock.now(organizationId)
    const changed = await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const sprint = await requireSprint(repos, organizationId, input.sprintId)
      const task = await repos.tasks.findById(organizationId, toTaskId(input.taskId))
      if (!task) throw new NotFoundError('Tarefa não encontrada')
      const sprintsOfProject = new Map(
        (await repos.sprints.listByProject(organizationId, sprint.projectId)).map((other) => [
          other.id,
          other,
        ]),
      )
      const memberships = (
        await repos.sprintTasks.listOpenByTasks(organizationId, [task.id])
      ).flatMap((row) => {
        const other = sprintsOfProject.get(row.sprintId)
        return other ? [{ sprint: other, row }] : []
      })
      const plan = addTaskToSprint({ sprint, task, memberships, at: now, actor })
      await repos.sprintTasks.saveRows(organizationId, [plan.row])
      const events = await toEvents(this.deps, actor, now, plan.timeline)
      const changedTasks: TaskId[] = []
      if (sprint.status === 'active' && isInBacklog(task)) {
        await repos.tasks.save(organizationId, pullFromBacklog(task, 'todo'))
        events.push(await pullEvent(this.deps, actor, now, task.id))
        changedTasks.push(task.id)
      }
      if (events.length > 0) await repos.timeline.saveMany(organizationId, events)
      await recordGuideEvent(repos, actor, sprint.projectId, 'sprint.task_added', now)
      return changedTasks
    })
    if (changed.length > 0)
      await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: [...changed] })
    return reloadDetail(this.deps, actor, toSprintId(input.sprintId))
  }
}

/** Tira o item da sprint. A linha fica no histórico; o item não volta ao backlog (decisão C). */
export class RemoveSprintTask {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly sprintId: string; readonly taskId: string },
  ): Promise<SprintDetailDto> {
    const organizationId = actor.organizationId
    await sprintScope(this.deps, actor, input.sprintId, canPlanSprint, PLANNING_DENIED)
    const now = await this.deps.clock.now(organizationId)
    await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const sprint = await requireSprint(repos, organizationId, input.sprintId)
      const taskId = toTaskId(input.taskId)
      const row = (await repos.sprintTasks.listOpenByTasks(organizationId, [taskId])).find(
        (candidate) => candidate.sprintId === sprint.id,
      )
      if (!row) throw new NotFoundError('Tarefa não está nesta sprint')
      const plan = removeTaskFromSprint({ sprint, row, at: now, actor })
      await repos.sprintTasks.saveRows(organizationId, [plan.row])
      await repos.timeline.saveMany(
        organizationId,
        await toEvents(this.deps, actor, now, plan.timeline),
      )
    })
    return reloadDetail(this.deps, actor, toSprintId(input.sprintId))
  }
}
