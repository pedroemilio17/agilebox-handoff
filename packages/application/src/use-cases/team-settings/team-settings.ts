import {
  canManageTeamModules,
  effectiveCapabilities,
  isExperienceLevel,
  PermissionDeniedError,
  sidebarScreens,
  SUGGESTED_LEVEL,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  ExperienceLevel,
  OrganizationId,
  SidebarScreenId,
  TenantContext,
} from '@agilebox/core'
import type { AppDeps } from '../../deps'
import type { UnitOfWorkRepositories } from '../../ports'
import { effectiveModuleStates } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'
import { toStatuses } from '../team-modules/team-modules'
import type { TeamModuleStatus } from '../team-modules/team-modules'

export interface SetTeamLevelInput {
  readonly level: string
}

/** O que a pessoa precisa para montar o menu: nível do time, telas liberadas e estados dos módulos. */
export interface TeamCapabilities {
  readonly level: ExperienceLevel
  readonly screens: readonly SidebarScreenId[]
  readonly statuses: readonly TeamModuleStatus[]
}

/**
 * Nível gravado do time. Enquanto o time não gravou nenhum, vale o nível sugerido (Padrão), que é
 * o mesmo de antes do M2.9b, então um time novo não muda de aparência.
 */
async function readLevel(
  repositories: Pick<UnitOfWorkRepositories, 'teamSettings'>,
  organizationId: OrganizationId,
): Promise<ExperienceLevel> {
  const settings = await repositories.teamSettings.find(organizationId)
  return settings?.level ?? SUGGESTED_LEVEL
}

/** Lê o nível do time. Qualquer integrante lê, porque o menu de cada um depende dele. */
export class GetTeamLevel {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<ExperienceLevel> {
    const organizationId = assertTenant(ctx, actor)
    return this.deps.unitOfWork.run(organizationId, (repositories) =>
      readLevel(repositories, organizationId),
    )
  }
}

/**
 * Grava o nível do time (M2.9b). Só o gestor grava. Pedir o nível que já vale não regrava o
 * registro, então quem e quando trocou continuam os da última troca de fato.
 */
export class SetTeamLevel {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: SetTeamLevelInput,
  ): Promise<ExperienceLevel> {
    const organizationId = assertTenant(ctx, actor)
    if (!canManageTeamModules(actor)) {
      throw new PermissionDeniedError('Só o gestor altera o nível do time')
    }
    // Entrada ausente (ou sem `level`) vira erro de validação, não TypeError.
    const level = input?.level
    if (typeof level !== 'string' || !isExperienceLevel(level)) {
      throw new ValidationError(`Nível desconhecido: ${String(level)}`)
    }
    const changedAt = await this.deps.clock.now(organizationId)

    return this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const current = await readLevel(repositories, organizationId)
      if (current === level) return level
      await repositories.teamSettings.save(organizationId, {
        level,
        changedBy: actor.userId,
        changedAt,
      })
      return level
    })
  }
}

/**
 * Capacidades de quem pede (M2.9b): nível gravado, ferramentas ligadas e papel, combinados por
 * `effectiveCapabilities` e `sidebarScreens` do core. O adaptador IPC só repassa o resultado.
 */
export class GetTeamCapabilities {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<TeamCapabilities> {
    const organizationId = assertTenant(ctx, actor)
    const { stored, level } = await this.deps.unitOfWork.run(
      organizationId,
      async (repositories) => ({
        stored: await repositories.teamModules.list(organizationId),
        level: await readLevel(repositories, organizationId),
      }),
    )

    const states = effectiveModuleStates(stored)
    // Ferramenta em encerramento conta como ligada: ainda tem itens em uso.
    const modules = [...states].filter(([, state]) => state !== 'disabled').map(([id]) => id)
    const capabilities = effectiveCapabilities({ modules, level, role: actor.role })

    return {
      level: capabilities.level,
      screens: sidebarScreens(capabilities),
      statuses: toStatuses(states),
    }
  }
}
