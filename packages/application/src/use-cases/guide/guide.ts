import {
  buildGuideTrail,
  canSeeProject,
  getProjectPreset,
  guideIntensity,
  guideProgress,
  isWelcomeDue,
  NotFoundError,
  PermissionDeniedError,
  resolveGuideExperience,
  toProjectId,
} from '@agilebox/core'
import type { Actor, Project, ProjectId } from '@agilebox/core'
import type {
  DismissGuideCardInput,
  GetGuideInput,
  GuideStepDto,
  GuideViewDto,
  GuideWelcomeDto,
  ResolveGuideWelcomeInput,
} from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import type { ProjectMember, ProjectModuleSetting } from '../../ports'
import { GUIDE_CARD_KEY, GUIDE_WELCOME_KEY } from '../../ports/guide-progress-repository'
import { activeGuideModules, doneStepKeys } from './record-guide-event'

/**
 * Projeto da organização do ator, com a regra de leitura: gestor, ou participante do projeto. É a
 * mesma regra de `projectModules.get`. Projeto de outra organização não existe para o ator. Devolve
 * também a participação da pessoa (nula quando não é membro).
 */
async function readableProject(
  deps: AppDeps,
  actor: Actor,
  projectId: ProjectId,
): Promise<{ project: Project; member: ProjectMember | null }> {
  const project = await deps.projects.findById(actor.organizationId, projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  const members = await deps.projects.listMembers(actor.organizationId, projectId)
  const member = members.find((candidate) => candidate.userId === actor.userId) ?? null
  if (!canSeeProject(actor, project, member !== null))
    throw new PermissionDeniedError('Sem acesso a este projeto')
  return { project, member }
}

/**
 * Trilha do guia do projeto e o progresso da pessoa que lê. Só leitura: nada é marcado aqui, o
 * passo se conclui pela ação (ver `recordGuideEvent`).
 */
export class GetGuide {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: GetGuideInput): Promise<GuideViewDto> {
    const projectId = toProjectId(input.projectId)
    const { project, member } = await readableProject(this.deps, actor, projectId)
    const organizationId = actor.organizationId

    const rows = await this.deps.projectModules.list(organizationId, projectId)
    const trail = buildGuideTrail(activeGuideModules(rows))
    const entries = await this.deps.guideProgress.listForUser(
      organizationId,
      projectId,
      actor.userId,
    )
    const done = doneStepKeys(entries)
    const progress = guideProgress(trail, done)

    // O nível por pessoa ainda não existe (ADR-10): a experiência vem só do projeto.
    const setup = await this.deps.projectSetup.get(organizationId, projectId)
    const experience = resolveGuideExperience(setup?.guideLevel ?? null, null)

    // Janela de boas-vindas (ADR-10): regra e condições em `isWelcomeDue` (domínio).
    const showWelcome = isWelcomeDue({
      actorUserId: actor.userId,
      project,
      member,
      trailSteps: trail.length,
      answered: entries.some((entry) => entry.stepKey === GUIDE_WELCOME_KEY),
    })
    const welcome: GuideWelcomeDto | null = showWelcome
      ? welcomeOf(project, setup?.startedFromPreset ?? null, rows)
      : null

    const steps: GuideStepDto[] = trail.map((step) => ({
      key: step.key,
      title: step.title,
      why: step.why,
      moduleId: step.moduleId,
      moduleName: step.moduleName,
      next: step.next,
      doneWhen: step.doneWhen,
      done: done.has(step.key),
    }))

    return {
      projectId,
      trail: steps,
      done: progress.done,
      total: progress.total,
      currentKey: progress.current?.key ?? null,
      experience,
      intensity: { ...guideIntensity(experience) },
      cardDismissed: entries.some((entry) => entry.stepKey === GUIDE_CARD_KEY && entry.dismissed),
      showWelcome,
      welcome,
    }
  }
}

/** Texto e números da janela de boas-vindas: nome do projeto, preset de partida e módulos ligados. */
function welcomeOf(
  project: Project,
  presetKey: GuideWelcomeDto['presetKey'],
  rows: readonly ProjectModuleSetting[],
): GuideWelcomeDto {
  return {
    projectName: project.name,
    presetKey,
    presetLabel: presetKey ? getProjectPreset(presetKey).label : null,
    moduleCount: activeGuideModules(rows).filter((moduleId) => moduleId !== 'core').length,
  }
}

/** Dispensa o cartão "Primeiros passos" para o ator, neste projeto. Vale só para ele. */
export class DismissGuideCard {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: DismissGuideCardInput): Promise<void> {
    const projectId = toProjectId(input.projectId)
    await readableProject(this.deps, actor, projectId)
    const now = await this.deps.clock.now(actor.organizationId)
    await this.deps.guideProgress.dismissCard(actor.organizationId, projectId, actor.userId, now)
  }
}

/**
 * Marca que a pessoa respondeu à janela de boas-vindas ("ver a trilha" ou "agora não"). Vale só
 * para ela, neste projeto. Idempotente. Só participante responde: a janela só existe para membros.
 */
export class ResolveWelcome {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ResolveGuideWelcomeInput): Promise<void> {
    const projectId = toProjectId(input.projectId)
    const { member } = await readableProject(this.deps, actor, projectId)
    if (member === null)
      throw new PermissionDeniedError('Só participantes do projeto respondem à boas-vindas')
    const now = await this.deps.clock.now(actor.organizationId)
    await this.deps.guideProgress.resolveWelcome(actor.organizationId, projectId, actor.userId, now)
  }
}
