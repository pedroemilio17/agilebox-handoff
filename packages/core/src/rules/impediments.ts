import {
  assignImpediment,
  changeImpedimentReason,
  openImpediment,
  resolveImpediment,
} from '../entities/impediment'
import type { Impediment } from '../entities/impediment'
import type { Task } from '../entities/task'
import type { TimelineEventDraft } from './timeline'
import { participates } from '../policies/access-policy'
import { ConflictError, ValidationError } from '../shared/errors'
import type { ImpedimentId, OrganizationId, UserId } from '../shared/ids'
import type { UserRole } from '../values/role'

/** Quem pode ser responsável por resolver: o usuário, com a organização e o papel que o domínio confere. */
export interface ImpedimentOwnerCandidate {
  readonly userId: UserId
  readonly organizationId: OrganizationId
  readonly role: UserRole
}

/** Responsável por resolver precisa participar da tarefa (criador, Responsável ou Apoio) ou ser o gestor. */
export function canBeImpedimentOwner(task: Task, candidate: ImpedimentOwnerCandidate): boolean {
  if (candidate.organizationId !== task.organizationId) return false
  return candidate.role === 'manager' || participates(candidate, task)
}

export function assertImpedimentOwnerEligible(
  task: Task,
  candidate: ImpedimentOwnerCandidate,
): void {
  if (!canBeImpedimentOwner(task, candidate))
    throw new ValidationError(
      'Responsável pelo impedimento deve participar da tarefa ou ser o gestor',
    )
}

export interface ImpedimentSyncInput {
  /** Tarefa depois da mudança (já com `blockedReason` e `blockedAt` aplicados). */
  readonly after: Task
  /** Impedimento aberto da tarefa antes da mudança (nulo se não há). */
  readonly open: Impediment | null
  /** Id do impedimento novo, obrigatório quando a tarefa passa a ter um impedimento aberto. */
  readonly newId: ImpedimentId | null
  readonly actor: UserId
  readonly at: string
  /**
   * Responsável pedido. `undefined` mantém o atual, `null` limpa, um candidato define (com a
   * elegibilidade conferida aqui).
   */
  readonly owner?: ImpedimentOwnerCandidate | null | undefined
  /** Nota de resolução, usada só quando o impedimento aberto é resolvido. */
  readonly resolution: string | null
}

export interface ImpedimentSyncPlan {
  /** Impedimentos a gravar, na mesma transação da tarefa. */
  readonly saves: readonly Impediment[]
  /** Eventos de responsável (`impediment_assigned`); blocked/unblocked saem de `diffTask`. */
  readonly drafts: readonly TimelineEventDraft[]
}

/**
 * Mantém o impedimento em sincronia com a marca de bloqueio da tarefa (função pura):
 * - tarefa passa a bloqueada: abre um impedimento (com o responsável, se houver);
 * - bloqueada de novo com outro motivo: atualiza o motivo do aberto (nunca há dois abertos);
 * - tarefa deixa de estar bloqueada (desbloquear, concluir, ...): resolve o aberto com a nota;
 * - responsável pedido: troca ou limpa no aberto, e registra na linha do tempo.
 */
export function planImpedimentSync(input: ImpedimentSyncInput): ImpedimentSyncPlan {
  const { after, open, actor, at } = input
  const isBlocked = after.blockedReason !== null
  const owner = input.owner
  const saves: Impediment[] = []
  const drafts: TimelineEventDraft[] = []
  const assertOwner = (candidate: ImpedimentOwnerCandidate | null | undefined) => {
    if (candidate) assertImpedimentOwnerEligible(after, candidate)
  }

  if (!isBlocked) {
    if (owner) throw new ConflictError('Tarefa sem impedimento aberto não tem responsável')
    if (open !== null) saves.push(resolveImpediment(open, actor, at, input.resolution))
    return { saves, drafts }
  }

  if (open === null) {
    if (input.newId === null) throw new Error('Impedimento novo exige id')
    assertOwner(owner)
    const created = openImpediment({
      id: input.newId,
      organizationId: after.organizationId,
      taskId: after.id,
      reason: after.blockedReason ?? '',
      ownerId: owner?.userId ?? null,
      openedBy: actor,
      openedAt: at,
    })
    saves.push(created)
    if (created.ownerId !== null)
      drafts.push({
        type: 'impediment_assigned',
        payload: { impedimentId: created.id, before: null, after: created.ownerId },
      })
    return { saves, drafts }
  }

  let next = changeImpedimentReason(open, after.blockedReason ?? open.reason)
  if (owner !== undefined) {
    assertOwner(owner)
    next = assignImpediment(next, owner?.userId ?? null)
  }
  if (next.ownerId !== open.ownerId)
    drafts.push({
      type: 'impediment_assigned',
      payload: { impedimentId: next.id, before: open.ownerId, after: next.ownerId },
    })
  if (next !== open) saves.push(next)
  return { saves, drafts }
}
