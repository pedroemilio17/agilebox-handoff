import {
  canSeeProject,
  getManifest,
  MODULE_IDS,
  MODULE_LABELS,
  NotFoundError,
  PermissionDeniedError,
  planDisableModules,
  planEnableModules,
  toProjectId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, EnablePlan, ModuleId, ModuleState, Project, ProjectId } from '@agilebox/core'
import type {
  ChangeProjectModulesInput,
  GetProjectModulesInput,
  ProjectModuleDto,
  ProjectModulesChangeResultDto,
  ProjectModulesViewDto,
} from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import type { ProjectModuleChange, ProjectModuleSetting } from '../../ports'

const CORE: ModuleId = 'core'

/** Id do catálogo, recusado com `ValidationError` e mensagem clara se não existir. */
function catalogId(value: string): ModuleId {
  if (!(MODULE_IDS as readonly string[]).includes(value))
    throw new ValidationError(`Ferramenta desconhecida: ${value}`)
  return value as ModuleId
}

function requireManager(actor: Actor): void {
  if (actor.role !== 'manager')
    throw new PermissionDeniedError('Só o gestor pode mudar as ferramentas deste projeto')
}

/** Projeto da organização do ator. Projeto de outra organização não existe para ele. */
async function projectOf(deps: AppDeps, actor: Actor, projectId: ProjectId): Promise<Project> {
  const project = await deps.projects.findById(actor.organizationId, projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  return project
}

/** Ids ativos: o núcleo sempre, e os módulos cuja linha está `active`. Sem linha conta como desligado. */
function activeIdsOf(rows: readonly ProjectModuleSetting[]): ModuleId[] {
  return [
    CORE,
    ...rows
      .filter((row) => row.state === 'active' && row.moduleId !== CORE)
      .map((row) => row.moduleId),
  ]
}

/** Lista para a interface, em ordem do catálogo: todos os módulos, com o estado efetivo. */
function toModuleDtos(rows: readonly ProjectModuleSetting[]): ProjectModuleDto[] {
  return MODULE_IDS.map((id) => {
    const manifest = getManifest(id)
    const row = rows.find((item) => item.moduleId === id)
    const state: ModuleState = id === CORE ? 'active' : (row?.state ?? 'disabled')
    return {
      id,
      name: manifest.name,
      level: manifest.level,
      objective: manifest.objective,
      state,
      requires: [...manifest.requires],
      enhances: [...manifest.enhances],
      config: row?.config ?? null,
    }
  })
}

function enableRefusalMessage(plan: Extract<EnablePlan, { ok: false }>): string {
  switch (plan.reason) {
    case 'conflict': {
      const pairs = plan.conflicts
        .map(([a, b]) => `${MODULE_LABELS[a]} e ${MODULE_LABELS[b]}`)
        .join('; ')
      return `Não dá para ter ferramentas em conflito ativas juntas: ${pairs}. Escolha só uma delas`
    }
    case 'core_required':
      return 'O Núcleo é obrigatório e não pode ser desligado'
    case 'conflicting_request':
      return 'A mesma ferramenta não pode ser ligada e desligada no mesmo pedido'
    default:
      return 'Não foi possível ligar essas ferramentas neste projeto'
  }
}

function disableRefusalMessage(reason: string): string {
  if (reason === 'core_required') return 'O Núcleo é obrigatório e não pode ser desligado'
  if (reason === 'blocked_by_dependents')
    return 'Há ferramentas ativas que dependem desta. Desligue as dependentes junto, ou mantenha a ferramenta ligada'
  return 'Não foi possível desligar essas ferramentas neste projeto'
}

/** Só o que mudou de estado entra na gravação. O núcleo nunca entra. */
function changesBetween(
  before: readonly ModuleId[],
  after: readonly ModuleId[],
): ProjectModuleChange[] {
  return MODULE_IDS.filter((id) => id !== CORE)
    .filter((id) => before.includes(id) !== after.includes(id))
    .map((id): ProjectModuleChange => ({
      moduleId: id,
      state: after.includes(id) ? 'active' : 'disabled',
    }))
}

/** Lê os módulos do projeto. Qualquer participante (ou gestor) lê; o resto do projeto não muda. */
export class GetProjectModules {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: GetProjectModulesInput): Promise<ProjectModulesViewDto> {
    const projectId = toProjectId(input.projectId)
    const project = await projectOf(this.deps, actor, projectId)
    const members = await this.deps.projects.listMembers(actor.organizationId, projectId)
    const isMember = members.some((member) => member.userId === actor.userId)
    if (!canSeeProject(actor, project, isMember))
      throw new PermissionDeniedError('Sem acesso a este projeto')

    const rows = await this.deps.projectModules.list(actor.organizationId, projectId)
    return {
      projectId,
      modules: toModuleDtos(rows),
      canManage: actor.role === 'manager',
    }
  }
}

/**
 * Liga e desliga módulos do projeto (só o gestor). Ligar traz o que o módulo exige. Desligar traz
 * junto quem depende dele; se houver sprint ativa, o desligamento de Sprints fica agendado e nada
 * dele é gravado. Projeto arquivado não muda. Desligar nunca apaga configuração.
 */
export class ChangeProjectModules {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: ChangeProjectModulesInput,
  ): Promise<ProjectModulesChangeResultDto> {
    requireManager(actor)
    const projectId = toProjectId(input.projectId)
    const enable = (input.enable ?? []).map(catalogId)
    const disable = (input.disable ?? []).map(catalogId)
    if (enable.some((id) => disable.includes(id)))
      throw new ValidationError(
        'A mesma ferramenta não pode ser ligada e desligada no mesmo pedido',
      )

    const organizationId = actor.organizationId
    const now = await this.deps.clock.now(organizationId)
    return this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const project = await repositories.projects.findById(organizationId, projectId)
      if (!project) throw new NotFoundError('Projeto não encontrado')
      if (project.archivedAt !== null)
        throw new ValidationError('Projeto arquivado: as ferramentas não podem ser alteradas')

      const rows = await repositories.projectModules.list(organizationId, projectId)
      const before = activeIdsOf(rows)
      const hasActiveSprint =
        (await repositories.sprints.countActive(organizationId, projectId)) > 0

      const enablePlan = planEnableModules(before, enable)
      if (!enablePlan.ok) throw new ValidationError(enableRefusalMessage(enablePlan))

      const disablePlan = planDisableModules(enablePlan.enabled, disable, { hasActiveSprint })
      if (!disablePlan.ok) throw new ValidationError(disableRefusalMessage(disablePlan.reason))

      // Com agendamento, o plano não desliga nada: `enabled` já é o conjunto sem a desativação.
      const after = disablePlan.enabled
      const changes = changesBetween(before, after)
      if (changes.length > 0)
        await repositories.projectModules.save(
          organizationId,
          projectId,
          changes,
          actor.userId,
          now,
        )

      const saved = await repositories.projectModules.list(organizationId, projectId)
      const applied = disablePlan.scheduled.length === 0
      return {
        modules: toModuleDtos(saved),
        autoEnabled: [...enablePlan.autoEnabled],
        cascadeDisabled: applied ? [...disablePlan.cascadeDisabled] : [],
        scheduled: disablePlan.scheduled.map(({ moduleId, block }) => ({
          moduleId,
          reason: block.reason,
        })),
      }
    })
  }
}
