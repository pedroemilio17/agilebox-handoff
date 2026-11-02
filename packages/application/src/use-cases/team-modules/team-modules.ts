import {
  canManageTeamModules,
  isModuleId,
  MODULE_IDS,
  PermissionDeniedError,
  previewModuleImpact,
  resolveModuleSet,
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
  TenantContext,
} from '@agilebox/core'
import type { AppDeps } from '../../deps'
import type { TeamModuleConfig } from '../../ports'
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

function toStatuses(states: ReadonlyMap<ModuleId, ModuleState>): TeamModuleStatus[] {
  return MODULE_IDS.map((moduleId) => ({ moduleId, state: states.get(moduleId) ?? 'disabled' }))
}

function toModuleId(value: string): ModuleId {
  if (!isModuleId(value)) throw new ValidationError(`Módulo desconhecido: ${value}`)
  return value
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
 * Próximo estado de um módulo quando o gestor pede para (não) tê-lo ativo.
 * Só o gestor chega aqui, e a aplicação é direta: o encerramento gradual entra no M2,
 * então desativar leva direto a `disabled` e os dados ficam guardados.
 */
function nextState(current: ModuleState, wanted: boolean): ModuleState {
  if (wanted) return current === 'disabled' || current === 'winding_down' ? 'active' : current
  return current === 'disabled' ? current : 'disabled'
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
  ): Promise<readonly TeamModuleStatus[]> {
    const organizationId = assertTenant(ctx, actor)
    if (!canManageTeamModules(actor)) {
      throw new PermissionDeniedError('Só o gestor altera as ferramentas do time')
    }
    const change: ModuleChange = {
      enable: (input.enable ?? []).map(toModuleId),
      disable: (input.disable ?? []).map(toModuleId),
    }
    const now = await this.deps.clock.now(organizationId)

    return this.deps.unitOfWork.run(organizationId, async ({ teamModules, teamModuleEvents }) => {
      const stored = await teamModules.list(organizationId)
      const storedById = new Map(stored.map((item) => [item.moduleId, item]))
      const current = new Map(effectiveModuleStates(stored))

      // Dependências contam módulos encerrando também, porque eles ainda têm itens em uso.
      const inSet = MODULE_IDS.filter((id) => current.get(id) !== 'disabled')
      const resolution = resolveModuleSet(inSet, change)
      if (!resolution.ok) throw new ValidationError(describeRefusal(resolution))

      const desired = new Set<ModuleId>(resolution.enabled)
      const next = new Map(current)
      for (const moduleId of MODULE_IDS) {
        const from = current.get(moduleId) ?? 'disabled'
        const to = nextState(from, desired.has(moduleId))
        if (to === from) continue

        next.set(moduleId, to)
        await teamModules.save(organizationId, {
          moduleId,
          state: to,
          config: storedById.get(moduleId)?.config ?? EMPTY_CONFIG,
          changedBy: actor.userId,
          changedAt: now,
        })
        await teamModuleEvents.append(organizationId, {
          id: await this.deps.idGenerator.generate(organizationId),
          moduleId,
          fromState: from,
          toState: to,
          changedBy: actor.userId,
          changedAt: now,
        })
      }
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

    const available: ItemCounts = await this.deps.unitOfWork.run(
      organizationId,
      async ({ tasks, projects, participations, meetings }) => ({
        tasks: await tasks.count(organizationId),
        projects: (await projects.list(organizationId)).length,
        participations: await participations.count(organizationId),
        meetings: await meetings.count(organizationId),
      }),
    )
    return MODULE_IDS.filter((id) => wanted.has(id)).map((id) => previewModuleImpact(id, available))
  }
}
