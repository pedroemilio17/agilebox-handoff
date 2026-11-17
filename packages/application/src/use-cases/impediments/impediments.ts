import {
  canResolveImpediment,
  canSeeImpediment,
  ConflictError,
  formatTaskKey,
  isInBacklog,
  NotFoundError,
  PermissionDeniedError,
  toImpedimentId,
  toProjectId,
  toUserId,
  unblockTask,
} from '@agilebox/core'
import type { Actor, Impediment, OrganizationId } from '@agilebox/core'
import type {
  AssignImpedimentInput,
  ImpedimentDto,
  ImpedimentListItemDto,
  ListImpedimentsInput,
  ResolveImpedimentInput,
} from '@agilebox/contract'
import { toImpedimentDto, toImpedimentListItemDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { ChangeTask } from '../tasks/tasks'
import { findTaskPrefix } from '../tasks/task-prefix'
import { loadImpedimentOwner, loadOwnerNames } from './impediment-refs'

async function requireImpediment(
  deps: Pick<AppDeps, 'impediments'>,
  organizationId: OrganizationId,
  rawId: string,
): Promise<Impediment> {
  const impediment = await deps.impediments.findById(organizationId, toImpedimentId(rawId))
  if (!impediment) throw new NotFoundError('Impedimento não encontrado')
  return impediment
}

async function toDto(
  deps: Pick<AppDeps, 'impediments' | 'users'>,
  organizationId: OrganizationId,
  impediment: Impediment,
): Promise<ImpedimentDto> {
  const names = await loadOwnerNames(deps, organizationId, [impediment.ownerId])
  return toImpedimentDto(
    impediment,
    impediment.ownerId === null ? null : (names.get(impediment.ownerId) ?? null),
  )
}

/**
 * Lista de impedimentos (M5.2a). Padrão: só abertos. O gestor vê os da organização; quem participa
 * vê os das tarefas de que participa. Tarefa arquivada e item de backlog ficam de fora. Ordem: os
 * abertos há mais tempo primeiro (desempate pelo id).
 */
export class ListImpediments {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ListImpedimentsInput): Promise<ImpedimentListItemDto[]> {
    const rows = await this.deps.impediments.listByOrganization(actor.organizationId, {
      ownerId: input.ownerId === undefined ? undefined : toUserId(input.ownerId),
      includeResolved: input.includeResolved === true,
    })
    const taskIds = [...new Set(rows.map((row) => row.taskId))]
    const tasks = new Map(
      (await this.deps.tasks.findManyById(actor.organizationId, taskIds)).map((task) => [
        task.id,
        task,
      ]),
    )
    const projectId = input.projectId === undefined ? null : toProjectId(input.projectId)
    const visible = rows.flatMap((row) => {
      const task = tasks.get(row.taskId)
      if (!task || task.archivedAt !== null || isInBacklog(task)) return []
      if (!canSeeImpediment(actor, task)) return []
      if (projectId !== null && task.projectId !== projectId) return []
      return [{ row, task }]
    })
    const names = await loadOwnerNames(
      this.deps,
      actor.organizationId,
      visible.map(({ row }) => row.ownerId),
    )
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    return visible
      .sort(
        (a, b) => a.row.openedAt.localeCompare(b.row.openedAt) || a.row.id.localeCompare(b.row.id),
      )
      .map(({ row, task }) =>
        toImpedimentListItemDto(
          row,
          row.ownerId === null ? null : (names.get(row.ownerId) ?? null),
          {
            key: formatTaskKey(prefix, task.number),
            title: task.title,
            projectId: task.projectId,
            projectName: task.projectName,
          },
        ),
      )
  }
}

/**
 * Troca ou limpa o responsável de um impedimento aberto. Quem edita a tarefa (participante ou gestor).
 * O novo responsável precisa participar da tarefa ou ser o gestor. Fica na linha do tempo.
 */
export class AssignImpediment extends ChangeTask {
  async execute(actor: Actor, input: AssignImpedimentInput): Promise<ImpedimentDto> {
    const current = await requireImpediment(this.deps, actor.organizationId, input.impedimentId)
    if (current.status === 'resolved')
      throw new ConflictError('Impedimento resolvido não muda de responsável')
    const owner =
      input.ownerId === null
        ? null
        : await loadImpedimentOwner(this.deps, actor.organizationId, input.ownerId)
    await this.change(actor, current.taskId, (task) => task, [], [], 'edit', undefined, { owner })
    const saved = await requireImpediment(this.deps, actor.organizationId, current.id)
    return toDto(this.deps, actor.organizationId, saved)
  }
}

/**
 * Resolve o impedimento aberto: é o desbloqueio com nota, e a tarefa sai do estado bloqueado. Quem
 * edita a tarefa ou o próprio responsável por resolver (mesmo sem participar). Tarefa arquivada não muda.
 */
export class ResolveImpediment extends ChangeTask {
  async execute(actor: Actor, input: ResolveImpedimentInput): Promise<ImpedimentDto> {
    const current = await requireImpediment(this.deps, actor.organizationId, input.impedimentId)
    if (current.status === 'resolved') throw new ConflictError('Impedimento já foi resolvido')
    await this.change(
      actor,
      current.taskId,
      (task) => unblockTask(task),
      [],
      [],
      (who, task) => {
        if (task.archivedAt !== null)
          throw new ConflictError('Tarefa arquivada não altera impedimento')
        if (!canResolveImpediment(who, task, current))
          throw new PermissionDeniedError('Sem permissão para resolver este impedimento')
      },
      undefined,
      { resolution: input.resolution ?? null },
    )
    const saved = await requireImpediment(this.deps, actor.organizationId, current.id)
    return toDto(this.deps, actor.organizationId, saved)
  }
}
