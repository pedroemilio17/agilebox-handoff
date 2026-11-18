import { moduleStateOf, NotFoundError, toUserId } from '@agilebox/core'
import type {
  ImpedimentOwnerCandidate,
  OrganizationId,
  ProjectId,
  TaskId,
  UserId,
} from '@agilebox/core'
import type { ImpedimentDto, ImpedimentRefDto } from '@agilebox/contract'
import { toImpedimentDto, toImpedimentRefDto } from '../../mappers'
import type { AppDeps } from '../../deps'

type ImpedimentDeps = Pick<AppDeps, 'projectModules' | 'impediments' | 'tasks' | 'users'>

/**
 * Tarefas cujo projeto tem o módulo `impediments` ligado (ADR-10: o estado é do projeto da tarefa).
 * Desligado no projeto, os impedimentos dele não aparecem nas respostas (esconde, não apaga).
 */
async function tasksWithImpedimentsVisible(
  deps: ImpedimentDeps,
  organizationId: OrganizationId,
  taskIds: readonly TaskId[],
): Promise<Set<TaskId>> {
  const visibleByProject = new Map<ProjectId, boolean>()
  const visible = new Set<TaskId>()
  for (const taskId of new Set(taskIds)) {
    const task = await deps.tasks.findById(organizationId, taskId)
    if (!task) continue
    if (!visibleByProject.has(task.projectId)) {
      const rows = await deps.projectModules.list(organizationId, task.projectId)
      visibleByProject.set(task.projectId, moduleStateOf(rows, 'impediments') !== 'disabled')
    }
    if (visibleByProject.get(task.projectId) === true) visible.add(taskId)
  }
  return visible
}

/** Nomes dos responsáveis, em lote e sem repetir consulta. */
export async function loadOwnerNames(
  deps: Pick<AppDeps, 'users'>,
  organizationId: OrganizationId,
  ownerIds: readonly (UserId | null)[],
): Promise<ReadonlyMap<UserId, string>> {
  const ids = [...new Set(ownerIds.filter((id): id is UserId => id !== null))]
  const names = new Map<UserId, string>()
  const users = await Promise.all(ids.map((id) => deps.users.findById(organizationId, id)))
  users.forEach((user, index) => {
    const id = ids[index]
    if (user && id) names.set(id, user.name)
  })
  return names
}

/** Impedimento aberto de cada tarefa pedida (cartões, listas e detalhe), em lote. */
export async function loadImpedimentRefs(
  deps: ImpedimentDeps,
  organizationId: OrganizationId,
  taskIds: readonly TaskId[],
): Promise<ReadonlyMap<TaskId, ImpedimentRefDto>> {
  const refs = new Map<TaskId, ImpedimentRefDto>()
  if (taskIds.length === 0) return refs
  const found = await deps.impediments.listOpenByTasks(organizationId, taskIds)
  const visible = await tasksWithImpedimentsVisible(
    deps,
    organizationId,
    found.map((row) => row.taskId),
  )
  const rows = found.filter((row) => visible.has(row.taskId))
  const names = await loadOwnerNames(
    deps,
    organizationId,
    rows.map((row) => row.ownerId),
  )
  for (const row of rows)
    refs.set(
      row.taskId,
      toImpedimentRefDto(row, row.ownerId === null ? null : (names.get(row.ownerId) ?? null)),
    )
  return refs
}

/** Histórico completo de impedimentos da tarefa (resolvidos incluídos), para o detalhe. */
export async function loadImpedimentHistory(
  deps: ImpedimentDeps,
  organizationId: OrganizationId,
  taskId: TaskId,
): Promise<ImpedimentDto[]> {
  const visible = await tasksWithImpedimentsVisible(deps, organizationId, [taskId])
  if (!visible.has(taskId)) return []
  const rows = await deps.impediments.listByTask(organizationId, taskId)
  const names = await loadOwnerNames(
    deps,
    organizationId,
    rows.map((row) => row.ownerId),
  )
  return rows.map((row) =>
    toImpedimentDto(row, row.ownerId === null ? null : (names.get(row.ownerId) ?? null)),
  )
}

/** Responsável pedido para o impedimento: o usuário e o papel que o domínio confere. */
export async function loadImpedimentOwner(
  deps: Pick<AppDeps, 'users'>,
  organizationId: OrganizationId,
  rawUserId: string,
): Promise<ImpedimentOwnerCandidate> {
  const userId = toUserId(rawUserId)
  const user = await deps.users.findById(organizationId, userId)
  if (!user) throw new NotFoundError('Responsável não encontrado')
  return { userId, organizationId, role: user.role }
}
