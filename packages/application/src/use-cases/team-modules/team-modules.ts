import {
  canManageTeamModules,
  isModuleId,
  MODULE_IDS,
  PermissionDeniedError,
  previewModuleImpact,
  resolveModuleSet,
  transitionModuleState,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  ItemCounts,
  ModuleChange,
  ModuleId,
  ModuleImpact,
  ModuleResolution,
  ModuleState,
  OrganizationId,
  TenantContext,
} from '@agilebox/core'
import type { AppDeps } from '../../deps'
import type { TeamModuleConfig, UnitOfWorkRepositories } from '../../ports'
import { effectiveModuleStates } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'

const EMPTY_CONFIG: TeamModuleConfig = {}

export interface TeamModuleStatus {
  readonly moduleId: ModuleId
  readonly state: ModuleState
}

export interface ChangeTeamModulesInput {
  readonly enable?: readonly string[]
  readonly disable?: readonly string[]
}

export interface ChangeTeamModulesResult {
  readonly statuses: readonly TeamModuleStatus[]
  /**
   * Módulos que entraram em encerramento nesta mudança, com a prévia do que continua no time
   * até o encerramento terminar. Vazio quando não havia itens a encerrar.
   */
  readonly windingDown: readonly ModuleImpact[]
}

export interface FinishTeamModuleWindingDownInput {
  readonly moduleId: string
}

/** Estado de cada módulo do catálogo, na ordem do catálogo (módulo sem registro vira desligado). */
export function toStatuses(states: ReadonlyMap<ModuleId, ModuleState>): TeamModuleStatus[] {
  return MODULE_IDS.map((moduleId) => ({ moduleId, state: states.get(moduleId) ?? 'disabled' }))
}

function toModuleId(value: string): ModuleId {
  if (!isModuleId(value)) throw new ValidationError(`Módulo desconhecido: ${value}`)
  return value
}

type ItemRepositories = Pick<
  UnitOfWorkRepositories,
  'tasks' | 'projects' | 'participations' | 'meetings'
>

/** Quantos itens de cada tipo existem no time (base da prévia de impacto). */
async function countItems(
  organizationId: OrganizationId,
  { tasks, projects, participations, meetings }: ItemRepositories,
): Promise<ItemCounts> {
  return {
    tasks: await tasks.count(organizationId),
    projects: (await projects.list(organizationId)).length,
    participations: await participations.count(organizationId),
    meetings: await meetings.count(organizationId),
  }
}

function describeRefusal(resolution: Extract<ModuleResolution, { ok: false }>): string {
  const reasons: string[] = []
  if (resolution.blockedBy.includes('core')) reasons.push('O núcleo não pode ser desativado')
  const blocked = resolution.blockedBy.filter((id) => id !== 'core')
  if (blocked.length > 0) {
    reasons.push(`Mudança recusada: ${blocked.join(', ')} ficaria sem o que precisa`)
  }
  for (const [first, second] of resolution.conflicts) {
    reasons.push(`Mudança recusada: ${first} conflita com ${second}`)
  }
  return reasons.join('. ')
}

/**
 * Próximo estado de um módulo quando o gestor pede para (não) tê-lo ativo (M2.4).
 * - Pedir ativo: `disabled` ou `winding_down` viram `active`. Reativar cancela o encerramento.
 * - Desligar um `active`: vai a `winding_down` se há itens que dependem dele; sem itens, `disabled`.
 * - Desligar um `winding_down` não muda nada: ele sai de `winding_down` só por
 *   `FinishTeamModuleWindingDown` ou por reativação.
 */
function nextState(current: ModuleState, wanted: boolean, hasItems: boolean): ModuleState {
  if (wanted) return 'active'
  if (current === 'active') return hasItems ? 'winding_down' : 'disabled'
  return current
}

function hasItems(impact: ModuleImpact): boolean {
  return Object.values(impact.counts).some((count) => count > 0)
}

interface Transition {
  readonly moduleId: ModuleId
  readonly from: ModuleState
  readonly to: ModuleState
  readonly config: TeamModuleConfig
  readonly repositories: Pick<UnitOfWorkRepositories, 'teamModules' | 'teamModuleEvents'>
}

/** Grava o novo estado e acrescenta o evento no histórico, na mesma transação (D7). */
async function recordTransition(
  deps: AppDeps,
  organizationId: OrganizationId,
  actor: Actor,
  changedAt: string,
  { moduleId, from, to, config, repositories }: Transition,
): Promise<void> {
  await repositories.teamModules.save(organizationId, {
    moduleId,
    state: to,
    config,
    changedBy: actor.userId,
    changedAt,
  })
  await repositories.teamModuleEvents.append(organizationId, {
    id: await deps.idGenerator.generate(organizationId),
    moduleId,
    fromState: from,
    toState: to,
    changedBy: actor.userId,
    changedAt,
  })
}

export class GetTeamModules {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<readonly TeamModuleStatus[]> {
    const organizationId = assertTenant(ctx, actor)
    const stored = await this.deps.unitOfWork.run(organizationId, ({ teamModules }) =>
      teamModules.list(organizationId),
    )
    return toStatuses(effectiveModuleStates(stored))
  }
}

export class ChangeTeamModules {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: ChangeTeamModulesInput,
  ): Promise<ChangeTeamModulesResult> {
    const organizationId = assertTenant(ctx, actor)
    if (!canManageTeamModules(actor)) {
      throw new PermissionDeniedError('Só o gestor altera as ferramentas do time')
    }
    const change: ModuleChange = {
      enable: (input.enable ?? []).map(toModuleId),
      disable: (input.disable ?? []).map(toModuleId),
    }
    const now = await this.deps.clock.now(organizationId)

    return this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const stored = await repositories.teamModules.list(organizationId)
      const storedById = new Map(stored.map((item) => [item.moduleId, item]))
      const current = new Map(effectiveModuleStates(stored))

      // Dependências contam módulos encerrando também, porque eles ainda têm itens em uso.
      const inSet = MODULE_IDS.filter((id) => current.get(id) !== 'disabled')
      const resolution = resolveModuleSet(inSet, change)
      if (!resolution.ok) throw new ValidationError(describeRefusal(resolution))

      const available = await countItems(organizationId, repositories)
      const desired = new Set<ModuleId>(resolution.enabled)
      const next = new Map(current)
      const windingDown: ModuleImpact[] = []
      for (const moduleId of MODULE_IDS) {
        const from = current.get(moduleId) ?? 'disabled'
        const impact = previewModuleImpact(moduleId, available)
        const to = nextState(from, desired.has(moduleId), hasItems(impact))
        if (to === from) continue

        if (to === 'winding_down') windingDown.push(impact)
        next.set(moduleId, to)
        await recordTransition(this.deps, organizationId, actor, now, {
          moduleId,
          from,
          to,
          config: storedById.get(moduleId)?.config ?? EMPTY_CONFIG,
          repositories,
        })
      }
      return { statuses: toStatuses(next), windingDown }
    })
  }
}

/**
 * Conclui o encerramento de um módulo (`winding_down` → `disabled`). Gestor only. Recusa se outro
 * módulo ainda ativo ou encerrando depende dele, pela mesma regra de dependência da mudança.
 */
export class FinishTeamModuleWindingDown {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: FinishTeamModuleWindingDownInput,
  ): Promise<readonly TeamModuleStatus[]> {
    const organizationId = assertTenant(ctx, actor)
    if (!canManageTeamModules(actor)) {
      throw new PermissionDeniedError('Só o gestor altera as ferramentas do time')
    }
    const moduleId = toModuleId(input.moduleId)
    const now = await this.deps.clock.now(organizationId)

    return this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const stored = await repositories.teamModules.list(organizationId)
      const storedById = new Map(stored.map((item) => [item.moduleId, item]))
      const current = effectiveModuleStates(stored)
      const from = current.get(moduleId) ?? 'disabled'
      if (from !== 'winding_down') {
        throw new ValidationError(`O módulo ${moduleId} não está encerrando`)
      }

      const others = MODULE_IDS.filter((id) => id !== moduleId && current.get(id) !== 'disabled')
      const resolution = resolveModuleSet(others, {})
      if (!resolution.ok) throw new ValidationError(describeRefusal(resolution))

      const to = transitionModuleState(from, 'finishWindingDown')
      const next = new Map(current).set(moduleId, to)
      await recordTransition(this.deps, organizationId, actor, now, {
        moduleId,
        from,
        to,
        config: storedById.get(moduleId)?.config ?? EMPTY_CONFIG,
        repositories,
      })
      return toStatuses(next)
    })
  }
}

export interface PreviewTeamModuleImpactInput {
  readonly disable?: readonly string[]
}

/**
 * Prévia de impacto (D4): para cada módulo pedido para desligar, quantas tarefas, projetos,
 * participações e reuniões dependem dele. Só leitura; a aplicação continua em `ChangeTeamModules`.
 * Módulos devolvidos seguem a ordem do catálogo.
 */
export class PreviewTeamModuleImpact {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: PreviewTeamModuleImpactInput,
  ): Promise<readonly ModuleImpact[]> {
    const organizationId = assertTenant(ctx, actor)
    if (!canManageTeamModules(actor)) {
      throw new PermissionDeniedError('Só o gestor vê a prévia de ferramentas do time')
    }
    const wanted = new Set((input.disable ?? []).map(toModuleId))

    const available = await this.deps.unitOfWork.run(organizationId, (repositories) =>
      countItems(organizationId, repositories),
    )
    return MODULE_IDS.filter((id) => wanted.has(id)).map((id) => previewModuleImpact(id, available))
  }
}
