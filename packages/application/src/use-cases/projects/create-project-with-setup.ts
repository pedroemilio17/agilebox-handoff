import {
  createProject,
  MODULE_IDS,
  planEnableModules,
  projectPresetModules,
  recommendPreset,
  toProjectId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, ModuleId, Project, ProjectPresetKey, WizardAnswers } from '@agilebox/core'
import type { CreateProjectWithSetupInput, ProjectWithSetupDto } from '@agilebox/contract'
import { toProjectDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import type { ProjectSetup } from '../../ports'
import { enableRefusalMessage } from '../project-modules/project-modules'
import { definitionItemsInForce } from './definition-of-done-in-force'

const CORE: ModuleId = 'core'

/** Id do catálogo, recusado com `ValidationError` e mensagem clara se não existir. */
function catalogId(value: string): ModuleId {
  if (!(MODULE_IDS as readonly string[]).includes(value))
    throw new ValidationError(`Ferramenta desconhecida: ${value}`)
  return value as ModuleId
}

/** Copia só as respostas informadas: ausente conta como resposta vazia (pulou a pergunta). */
function toWizardAnswers(raw: CreateProjectWithSetupInput['answers']): WizardAnswers {
  const answers: WizardAnswers = {}
  if (raw?.workType !== undefined) answers.workType = raw.workType
  if (raw?.fixedDate !== undefined) answers.fixedDate = raw.fixedDate
  if (raw?.scope !== undefined) answers.scope = raw.scope
  if (raw?.outsiderFollows !== undefined) answers.outsiderFollows = raw.outsiderFollows
  if (raw?.controlsHoursAndCost !== undefined)
    answers.controlsHoursAndCost = raw.controlsHoursAndCost
  if (raw?.experience !== undefined) answers.experience = raw.experience
  return answers
}

/** Módulos ligados (com `core`) em ordem do catálogo, a partir das linhas gravadas. */
function activeIdsOf(rows: readonly { moduleId: ModuleId; state: string }[]): ModuleId[] {
  return [
    CORE,
    ...rows
      .filter((row) => row.state === 'active' && row.moduleId !== CORE)
      .map((row) => row.moduleId),
  ]
}

/**
 * Cria o projeto já com o assistente (ADR-10) numa única operação atômica: projeto, membros,
 * módulos e configuração inicial. Regras de nome, permissão e membros são as de `createProject`.
 * Nome repetido seleciona o projeto existente, como em `createProject`, e aí o assistente não é
 * aplicado (o projeto existente mantém a configuração dele).
 */
export class CreateProjectWithSetup {
  constructor(private readonly deps: AppDeps) {}

  private async toDto(
    actor: Actor,
    project: Project,
    modules: readonly ModuleId[],
    startedFromPreset: ProjectPresetKey | null,
  ): Promise<ProjectWithSetupDto> {
    const items = await definitionItemsInForce(this.deps, actor.organizationId, project.id)
    return { ...toProjectDto(project, items.length), modules: [...modules], startedFromPreset }
  }

  /** Conjunto pedido: o informado; senão o preset escolhido; senão o que a recomendação resolveu. */
  private requestedModules(
    input: CreateProjectWithSetupInput,
    answers: WizardAnswers,
  ): readonly ModuleId[] {
    if (input.modules !== undefined) return input.modules.map(catalogId)
    if (input.startedFromPreset !== undefined) {
      const experienced = answers.experience === 'sometimes' || answers.experience === 'always'
      return projectPresetModules(input.startedFromPreset, { experienced })
    }
    return recommendPreset(answers).modules
  }

  async execute(actor: Actor, input: CreateProjectWithSetupInput): Promise<ProjectWithSetupDto> {
    const organizationId = actor.organizationId
    const answers = toWizardAnswers(input.answers)
    const recommendation = recommendPreset(answers)
    const startedFromPreset = input.startedFromPreset ?? recommendation.preset
    const guideLevel = input.guideLevel ?? recommendation.guideLevel

    // Valida o conjunto inteiro antes de qualquer gravação: dependências entram, conflito recusa.
    const plan = planEnableModules([], this.requestedModules(input, answers))
    if (!plan.ok) throw new ValidationError(enableRefusalMessage(plan))
    const enabled = plan.enabled

    const candidate = createProject({
      id: toProjectId(await this.deps.idGenerator.generate(organizationId)),
      organizationId,
      name: input.name,
      createdBy: actor.userId,
      createdAt: await this.deps.clock.now(organizationId),
    })
    const existing = await this.deps.projects.findByNameKey(organizationId, candidate.nameKey)
    if (existing) {
      const rows = await this.deps.projectModules.list(organizationId, existing.id)
      const setup = await this.deps.projectSetup.get(organizationId, existing.id)
      return this.toDto(actor, existing, activeIdsOf(rows), setup?.startedFromPreset ?? null)
    }

    const setup: ProjectSetup = {
      projectId: candidate.id,
      answers: input.answers === undefined ? null : answers,
      recommendedPreset: recommendation.preset,
      startedFromPreset,
      guideLevel,
    }
    const outcome = await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const raced = await repositories.projects.findByNameKey(organizationId, candidate.nameKey)
      if (raced) {
        const rows = await repositories.projectModules.list(organizationId, raced.id)
        const raceSetup = await repositories.projectSetup.get(organizationId, raced.id)
        return {
          project: raced,
          created: false,
          modules: activeIdsOf(rows),
          startedFromPreset: raceSetup?.startedFromPreset ?? null,
        }
      }
      await repositories.projects.save(organizationId, candidate)
      await repositories.projects.addMember(organizationId, {
        projectId: candidate.id,
        userId: actor.userId,
        addedBy: actor.userId,
        addedAt: candidate.createdAt,
      })
      const changes = enabled
        .filter((id) => id !== CORE)
        .map((id) => ({ moduleId: id, state: 'active' as const }))
      if (changes.length > 0)
        await repositories.projectModules.save(
          organizationId,
          candidate.id,
          changes,
          actor.userId,
          candidate.createdAt,
        )
      await repositories.projectSetup.save(organizationId, setup)
      return {
        project: candidate,
        created: true,
        modules: [...enabled],
        startedFromPreset,
      }
    })

    if (outcome.created) {
      await this.deps.changeNotifier.publish(organizationId, {
        kind: 'project',
        ids: [outcome.project.id],
      })
    }
    return this.toDto(actor, outcome.project, outcome.modules, outcome.startedFromPreset)
  }
}
