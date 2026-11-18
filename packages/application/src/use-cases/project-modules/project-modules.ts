import {
  canSeeProject,
  getManifest,
  MODULE_IDS,
  MODULE_LABELS,
  moduleStateOf,
  NotFoundError,
  PermissionDeniedError,
  planDisableModules,
  planEnableModules,
  toProjectId,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  EnablePlan,
  ModuleId,
  ModuleState,
  Project,
  ProjectId,
  TeamModuleConfig,
} from '@agilebox/core'
import type {
  ChangeProjectModulesInput,
  GetProjectModulesInput,
  OrganizationModulesViewDto,
  ProjectModuleDto,
  ProjectModulesChangeResultDto,
  ProjectModulesViewDto,
  SetProjectModuleConfigInput,
} from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { organizationModuleStateOf } from '../../module-guard'
import type { ProjectModuleChange, ProjectModuleSetting } from '../../ports'
import { validateModuleConfig } from '../team-tools/module-config'

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

/** Visão do projeto para a interface (o mesmo DTO de `projectModules.get`). */
function toProjectView(
  actor: Actor,
  projectId: ProjectId,
  rows: readonly ProjectModuleSetting[],
): ProjectModulesViewDto {
  return {
    projectId,
    modules: toModuleDtos(rows),
    canManage: actor.role === 'manager',
  }
}

/** Mensagem em pt-BR para um pedido de ligar módulos que o domínio recusou. */
export function enableRefusalMessage(plan: Extract<EnablePlan, { ok: false }>): string {
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
    return toProjectView(actor, projectId, rows)
  }
}

/**
 * Grava a configuração de um módulo neste projeto (só o gestor, ADR-10). A config é validada pelo
 * mesmo critério da equipe (`validateModuleConfig`). `{}` apaga a configuração do projeto e ele volta
 * a herdar a da equipe. Só mexe na configuração: o estado do módulo fica como está, e o módulo
 * precisa estar ligado. Projeto arquivado não muda.
 */
export class SetProjectModuleConfig {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: SetProjectModuleConfigInput): Promise<ProjectModulesViewDto> {
    requireManager(actor)
    const projectId = toProjectId(input.projectId)
    const moduleId = catalogId(input.moduleId)
    const config = validateModuleConfig(moduleId, input.config)
    // Objeto vazio quer dizer "sem configuração do projeto": grava null, que apaga a linha.
    const stored: TeamModuleConfig | null = Object.keys(config).length === 0 ? null : config
    const organizationId = actor.organizationId
    const now = await this.deps.clock.now(organizationId)
    return this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const project = await repositories.projects.findById(organizationId, projectId)
      if (!project) throw new NotFoundError('Projeto não encontrado')
      if (project.archivedAt !== null)
        throw new ValidationError('Projeto arquivado: a configuração não pode ser alterada')

      const rows = await repositories.projectModules.list(organizationId, projectId)
      if (moduleStateOf(rows, moduleId) !== 'active')
        throw new ValidationError('Ligue o módulo antes de configurá-lo')

      await repositories.projectModules.save(
        organizationId,
        projectId,
        [{ moduleId, state: 'active', config: stored }],
        actor.userId,
        now,
      )
      const saved = await repositories.projectModules.list(organizationId, projectId)
      return toProjectView(actor, projectId, saved)
    })
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

/**
 * Estado de cada módulo (exceto o núcleo) para a organização inteira: a regra de casos de uso sem
 * projeto (ADR-10). Quem não tem projeto selecionado usa isto na barra lateral. Qualquer pessoa
 * autenticada lê; devolve só o estado agregado, nunca os projetos. `hasActiveProjects` diz se a
 * regra da organização vale; sem projeto ativo, o estado de cada módulo já vem das ferramentas da
 * equipe (`organizationModuleStateOf`), e a interface segue essas ferramentas.
 */
export class GetOrganizationModules {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<OrganizationModulesViewDto> {
    const organizationId = actor.organizationId
    const projects = await this.deps.projects.list(organizationId)
    const hasActiveProjects = projects.some((project) => project.archivedAt === null)
    const modules = await Promise.all(
      MODULE_IDS.filter((id) => id !== CORE).map(async (id) => ({
        id,
        state: await organizationModuleStateOf(this.deps, organizationId, id),
      })),
    )
    return { modules, hasActiveProjects }
  }
}
