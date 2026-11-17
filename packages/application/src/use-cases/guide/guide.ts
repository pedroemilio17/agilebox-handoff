import {
  buildGuideTrail,
  canSeeProject,
  guideIntensity,
  guideProgress,
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
} from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { GUIDE_CARD_KEY } from '../../ports/guide-progress-repository'
import { activeGuideModules, doneStepKeys } from './record-guide-event'

/**
 * Projeto da organização do ator, com a regra de leitura: gestor, ou participante do projeto. É a
 * mesma regra de `projectModules.get`. Projeto de outra organização não existe para o ator.
 */
async function readableProject(
  deps: AppDeps,
  actor: Actor,
  projectId: ProjectId,
): Promise<Project> {
  const project = await deps.projects.findById(actor.organizationId, projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  const members = await deps.projects.listMembers(actor.organizationId, projectId)
  const isMember = members.some((member) => member.userId === actor.userId)
  if (!canSeeProject(actor, project, isMember))
    throw new PermissionDeniedError('Sem acesso a este projeto')
  return project
}

/**
 * Trilha do guia do projeto e o progresso da pessoa que lê. Só leitura: nada é marcado aqui, o
 * passo se conclui pela ação (ver `recordGuideEvent`).
 */
export class GetGuide {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: GetGuideInput): Promise<GuideViewDto> {
    const projectId = toProjectId(input.projectId)
    await readableProject(this.deps, actor, projectId)
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
    }
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
