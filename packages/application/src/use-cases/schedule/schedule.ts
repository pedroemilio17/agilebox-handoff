import {
  assertDependency,
  canSeeProject,
  ConflictError,
  createTimelineEvent,
  formatTaskKey,
  isManagerEdit,
  NotFoundError,
  parseDateOnly,
  PermissionDeniedError,
  setTaskStart,
  scheduleGuideEvent,
  toEventId,
  toProjectId,
  toTaskId,
} from '@agilebox/core'
import type {
  Actor,
  Project,
  Task,
  TaskDependency,
  TaskId,
  TimelineEventDraft,
} from '@agilebox/core'
import type { ScheduleViewDto, TaskDto } from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { recordGuideEvent } from '../guide/record-guide-event'
import { findTaskPrefix } from '../tasks/task-prefix'
import { ChangeTask } from '../tasks/tasks'
import { assertTaskEditable } from '../tasks/task-access'
import { scheduleViewOf } from './schedule-view'

/** Projeto da tarefa para montar a leitura: existe nesta organização, senão não há cronograma. */
async function projectOf(deps: AppDeps, actor: Actor, task: Task): Promise<Project> {
  const project = await deps.projects.findById(actor.organizationId, task.projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  return project
}

/** Tarefa da organização, ou erro de não encontrada (mesmo resultado para outra organização). */
async function taskOf(deps: AppDeps, actor: Actor, rawId: string): Promise<Task> {
  const task = await deps.tasks.findById(actor.organizationId, toTaskId(rawId))
  if (!task) throw new NotFoundError('Tarefa não encontrada')
  return task
}

/**
 * Define o início da tarefa (ADR-10, módulo `schedule`). Quem edita a tarefa define o início: a
 * regra é a da edição (`change`), com a linha do tempo `start_changed` e a marca Gestor. Com prazo e
 * início juntos, conclui o passo "Dê início e fim" (`task.scheduled`).
 */
export class SetTaskStart extends ChangeTask {
  async execute(
    actor: Actor,
    input: { readonly taskId: string; readonly startsOn: string | null },
  ): Promise<TaskDto> {
    const startsOn = input.startsOn === null ? null : parseDateOnly(input.startsOn)
    return this.change(
      actor,
      input.taskId,
      (task) => setTaskStart(task, startsOn),
      [],
      [],
      'edit',
      undefined,
      {},
      scheduleGuideEvent,
    )
  }
}

/**
 * Liga a sucessora à predecessora (término→início). Quem pode editar a SUCESSORA liga. Valida no
 * domínio: mesma tarefa, mesmo projeto, duplicata e ciclo. A sucessora ganha o evento
 * `dependency_changed` (com chave e título da predecessora) e o guia conclui "Dê início e fim".
 */
export class AddTaskDependency {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly predecessorId: string; readonly successorId: string },
  ): Promise<ScheduleViewDto> {
    const organizationId = actor.organizationId
    const successor = await taskOf(this.deps, actor, input.successorId)
    // Permissão antes de olhar a predecessora: quem não edita a sucessora não descobre nada dela.
    assertTaskEditable(actor, successor)
    const predecessor = await taskOf(this.deps, actor, input.predecessorId)
    if (predecessor.archivedAt !== null)
      throw new ConflictError('Tarefa arquivada não entra no cronograma')
    const project = await projectOf(this.deps, actor, successor)
    const existing = await this.deps.taskDependencies.listByProject(organizationId, project.id)
    assertDependency(predecessor, successor, existing)

    const now = await this.deps.clock.now(organizationId)
    const prefix = await findTaskPrefix(this.deps, organizationId)
    const dependency: TaskDependency = {
      organizationId,
      predecessorId: predecessor.id,
      successorId: successor.id,
      createdAt: now,
      createdBy: actor.userId,
    }
    await this.deps.unitOfWork.run(organizationId, async (repos) => {
      await repos.taskDependencies.add(organizationId, dependency)
      const event = await dependencyEvent(this.deps, actor, successor.id, now, {
        action: 'added',
        predecessor,
        prefix,
      })
      await repos.timeline.saveMany(organizationId, [event])
      await recordGuideEvent(repos, actor, project.id, 'task.scheduled', now)
    })
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'task',
      ids: [successor.id],
    })
    return scheduleViewOf(this.deps, actor, project, now)
  }
}

/** Remove a dependência da sucessora. Quem pode editar a sucessora remove; fica na linha do tempo. */
export class RemoveTaskDependency {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly predecessorId: string; readonly successorId: string },
  ): Promise<ScheduleViewDto> {
    const organizationId = actor.organizationId
    const successor = await taskOf(this.deps, actor, input.successorId)
    assertTaskEditable(actor, successor)
    const predecessorId = toTaskId(input.predecessorId)
    const linked = await this.deps.taskDependencies.listByTask(organizationId, successor.id)
    if (!linked.some((item) => item.predecessorId === predecessorId))
      throw new NotFoundError('Dependência não encontrada')
    const predecessor = await taskOf(this.deps, actor, input.predecessorId)
    const project = await projectOf(this.deps, actor, successor)

    const now = await this.deps.clock.now(organizationId)
    const prefix = await findTaskPrefix(this.deps, organizationId)
    await this.deps.unitOfWork.run(organizationId, async (repos) => {
      await repos.taskDependencies.remove(organizationId, predecessorId, successor.id)
      const event = await dependencyEvent(this.deps, actor, successor.id, now, {
        action: 'removed',
        predecessor,
        prefix,
      })
      await repos.timeline.saveMany(organizationId, [event])
    })
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'task',
      ids: [successor.id],
    })
    return scheduleViewOf(this.deps, actor, project, now)
  }
}

/** Evento `dependency_changed` da sucessora, com a chave e o título da predecessora gravados nele. */
async function dependencyEvent(
  deps: AppDeps,
  actor: Actor,
  successorId: TaskId,
  at: string,
  change: {
    readonly action: 'added' | 'removed'
    readonly predecessor: Task
    readonly prefix: string
  },
) {
  const draft: TimelineEventDraft = {
    type: 'dependency_changed',
    payload: {
      action: change.action,
      predecessorId: change.predecessor.id,
      predecessorKey: formatTaskKey(change.prefix, change.predecessor.number),
      predecessorTitle: change.predecessor.title,
    },
  }
  return createTimelineEvent({
    ...draft,
    id: toEventId(await deps.idGenerator.generate(actor.organizationId)),
    taskId: successorId,
    at,
    actorUserId: actor.userId,
    asManager: isManagerEdit(actor),
  })
}

/**
 * Leitura do cronograma do projeto (ADR-10). Quem vê o projeto lê. Abrir o cronograma marca o passo
 * "Acompanhe pelo cronograma" (`schedule.opened`). A marcação é uma gravação à parte: se ela falhar,
 * a leitura segue (o guia nunca derruba a tela; ver ADR-10, 3.8.1).
 */
export class GetSchedule {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<ScheduleViewDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(organizationId, projectId)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((item) => item.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError('Sem acesso a este projeto')

    const now = await this.deps.clock.now(organizationId)
    try {
      await this.deps.unitOfWork.run(organizationId, (repos) =>
        recordGuideEvent(repos, actor, projectId, 'schedule.opened', now),
      )
    } catch {
      // Passo do guia só registra a visita: falhar aqui não impede a leitura do cronograma.
    }
    return scheduleViewOf(this.deps, actor, project, now)
  }
}
