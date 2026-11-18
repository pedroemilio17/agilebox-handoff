import {
  canEditProjectStructure,
  canEditTask,
  compareDateOnly,
  deliverableCodes,
  dependencyConflict,
  formatTaskKey,
  moduleStateOf,
  toDateOnly,
} from '@agilebox/core'
import type { Actor, DateOnly, DeliverableId, Project, Task, UserId } from '@agilebox/core'
import type { ScheduleViewDto } from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { findTaskPrefix } from '../tasks/task-prefix'

/** Menor início e maior prazo entre as tarefas com as duas datas. Nulo quando nenhuma tem as duas. */
export function rangeOf(tasks: readonly Task[]): { start: DateOnly; end: DateOnly } | null {
  let start: DateOnly | null = null
  let end: DateOnly | null = null
  for (const task of tasks) {
    if (task.startsOn === null || task.deadline === null) continue
    if (start === null || compareDateOnly(task.startsOn, start) < 0) start = task.startsOn
    if (end === null || compareDateOnly(task.deadline, end) > 0) end = task.deadline
  }
  return start === null || end === null ? null : { start, end }
}

/**
 * Leitura do cronograma de um projeto (ADR-10, módulo `schedule`). Tarefas arquivadas ficam de fora,
 * junto com as dependências que as tocam. Código da entrega só com o módulo `wbs` ligado; marcos só
 * com `milestones` ligado. A linha de base não entra aqui (outro módulo).
 */
export async function scheduleViewOf(
  deps: AppDeps,
  actor: Actor,
  project: Project,
  now: string,
): Promise<ScheduleViewDto> {
  const organizationId = actor.organizationId
  const [allTasks, deliverables, dependencies, modules, users, prefix] = await Promise.all([
    deps.tasks.listByProject(organizationId, project.id),
    deps.deliverables.listByProject(organizationId, project.id),
    deps.taskDependencies.listByProject(organizationId, project.id),
    deps.projectModules.list(organizationId, project.id),
    deps.users.list(organizationId),
    findTaskPrefix(deps, organizationId),
  ])
  const wbsOn = moduleStateOf(modules, 'wbs') === 'active'
  const milestonesOn = moduleStateOf(modules, 'milestones') === 'active'
  const milestones = milestonesOn
    ? await deps.milestones.listByProject(organizationId, project.id)
    : []

  const tasks = allTasks.filter((task) => task.archivedAt === null)
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const names = new Map<UserId, string>(users.map((user) => [user.id, user.name]))
  const codes: ReadonlyMap<DeliverableId, string> = wbsOn
    ? deliverableCodes(deliverables)
    : new Map<DeliverableId, string>()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return {
    projectId: project.id,
    canEdit: canEditProjectStructure(actor, project) && project.archivedAt === null,
    range: rangeOf(tasks),
    tasks: tasks.map((task) => {
      const responsible = task.participations.find((item) => item.role === 'responsible')
      const responsibleName =
        responsible?.participant.kind === 'user'
          ? (names.get(responsible.participant.userId) ?? null)
          : null
      const done = task.status === 'done'
      return {
        taskId: task.id,
        key: formatTaskKey(prefix, task.number),
        title: task.title,
        status: task.status,
        deliverableId: task.deliverableId,
        deliverableCode:
          task.deliverableId === null ? null : (codes.get(task.deliverableId) ?? null),
        startsOn: task.startsOn,
        deadline: task.deadline,
        responsibleName,
        done,
        progress: done ? 100 : 0,
        canEdit: canEditTask(actor, task),
      }
    }),
    dependencies: dependencies.flatMap((dependency) => {
      const predecessor = byId.get(dependency.predecessorId)
      const successor = byId.get(dependency.successorId)
      if (!predecessor || !successor) return []
      return [
        {
          predecessorId: dependency.predecessorId,
          successorId: dependency.successorId,
          conflict: dependencyConflict(predecessor, successor),
        },
      ]
    }),
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      dueOn: milestone.dueOn,
    })),
    today: toDateOnly(new Date(now), timeZone),
  }
}
