import type { TeamModuleConfig } from '../modules/team-tools'
import {
  SPRINT_STATUS_LABELS,
  validateSprintDates,
  validateSprintGoal,
  validateSprintName,
} from '../entities/sprint'
import type { Sprint, SprintClosePolicy, SprintStatus } from '../entities/sprint'
import { ConflictError, ValidationError } from '../shared/errors'
import { compareDateOnly } from '../values/date-only'

/**
 * Ciclo de vida da sprint (M4.1). Regras puras: o instante (`at`) e os contadores chegam por
 * parâmetro, sem relógio global.
 *
 * Comportamento do módulo `sprints` com `winding_down` (M4.2 aplica, usando `moduleUseRefusal`):
 * não aceita sprint nova (`draft`) nem itens novos. A sprint `active` segue visível e editável
 * até encerrar; ao encerrar, o desfecho dos itens abertos segue a política escolhida.
 */

/** ADR-08: uma sprint ativa por projeto, como padrão da configuração do módulo Sprints. */
export const SPRINTS_MAX_ACTIVE_DEFAULT = 1
/** Chave do campo `config` do módulo `sprints` (TeamModuleSetting.config). */
export const SPRINTS_MAX_ACTIVE_CONFIG_KEY = 'maxActiveSprints'

/** Lê o limite de sprints ativas da configuração do módulo. Ausente = padrão; inválido = recusado. */
export function readSprintsMaxActive(config: TeamModuleConfig | undefined): number {
  const value = config?.[SPRINTS_MAX_ACTIVE_CONFIG_KEY]
  if (value === undefined) return SPRINTS_MAX_ACTIVE_DEFAULT
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new ValidationError('Limite de sprints ativas deve ser um número inteiro de 1 ou mais')
  return value
}

/** Pode iniciar mais uma sprint se ainda há vaga abaixo do limite do projeto. */
export function canStartSprint(activeCount: number, maxActive: number): boolean {
  if (!Number.isSafeInteger(activeCount) || activeCount < 0)
    throw new ValidationError('Contagem de sprints ativas inválida')
  if (!Number.isSafeInteger(maxActive) || maxActive < 1)
    throw new ValidationError('Limite de sprints ativas inválido')
  return activeCount < maxActive
}

const SPRINT_TRANSITIONS: Readonly<Record<SprintStatus, readonly SprintStatus[]>> = {
  draft: ['active'],
  active: ['closed'],
  closed: [],
}

export function canTransitionSprint(from: SprintStatus, to: SprintStatus): boolean {
  return SPRINT_TRANSITIONS[from].includes(to)
}

export function assertSprintTransition(from: SprintStatus, to: SprintStatus): void {
  if (canTransitionSprint(from, to)) return
  if (from === 'closed') throw new ConflictError('Sprint encerrada é só para leitura')
  throw new ConflictError(
    `Sprint ${SPRINT_STATUS_LABELS[from].toLocaleLowerCase('pt-BR')} não pode passar para ${SPRINT_STATUS_LABELS[to].toLocaleLowerCase('pt-BR')}`,
  )
}

/**
 * Inicia a sprint (rascunho → ativa). `activeCount` são as sprints ativas do projeto, `maxActive`
 * vem da configuração do módulo. Além do limite, recusa com CONFLICT.
 */
export function startSprint(
  sprint: Sprint,
  at: string,
  activeCount: number,
  maxActive: number,
): Sprint {
  assertSprintTransition(sprint.status, 'active')
  if (!canStartSprint(activeCount, maxActive)) {
    throw new ConflictError(
      maxActive === 1
        ? 'Já existe uma sprint ativa neste projeto. Encerre-a antes de iniciar outra'
        : `Este projeto já tem ${maxActive} sprints ativas, o limite configurado. Encerre uma antes de iniciar outra`,
    )
  }
  return { ...sprint, status: 'active', startedAt: at }
}

/**
 * Encerra a sprint (ativa → encerrada). Só marca a sprint: o desfecho dos itens é de
 * `planSprintClose` (rules/sprint-close.ts).
 */
export function endSprint(sprint: Sprint, at: string, policy: SprintClosePolicy): Sprint {
  assertSprintTransition(sprint.status, 'closed')
  return { ...sprint, status: 'closed', closedAt: at, closePolicy: policy }
}

export interface SprintEditChanges {
  readonly name?: string
  readonly goal?: string | null
  readonly plannedStart?: string
  readonly plannedEnd?: string
}

/**
 * Edita nome, meta e datas planejadas. Vale para rascunho e ativa; encerrada é só leitura.
 * Mudança sem efeito devolve a mesma sprint.
 */
export function updateSprint(sprint: Sprint, changes: SprintEditChanges): Sprint {
  if (sprint.status === 'closed') throw new ConflictError('Sprint encerrada é só para leitura')
  const name = validateSprintName(changes.name ?? sprint.name, sprint.number)
  const goal = changes.goal === undefined ? sprint.goal : validateSprintGoal(changes.goal)
  const dates = validateSprintDates(
    changes.plannedStart ?? sprint.plannedStart,
    changes.plannedEnd ?? sprint.plannedEnd,
  )
  const next = {
    ...sprint,
    name,
    goal,
    plannedStart: dates.plannedStart,
    plannedEnd: dates.plannedEnd,
  }
  return next.name === sprint.name &&
    next.goal === sprint.goal &&
    compareDateOnly(next.plannedStart, sprint.plannedStart) === 0 &&
    compareDateOnly(next.plannedEnd, sprint.plannedEnd) === 0
    ? sprint
    : next
}

/**
 * Próximo número do projeto: máximo + 1, começando em 1. Passe todas as sprints do projeto,
 * inclusive as descartadas, para que um número nunca seja reaproveitado.
 */
export function nextSprintNumber(existing: readonly Pick<Sprint, 'number'>[]): number {
  return existing.reduce((max, sprint) => Math.max(max, sprint.number), 0) + 1
}
