import { buildGuideTrail, completeStepsOnEvent } from '@agilebox/core'
import type { Actor, GuideEventType, ModuleId, ProjectId } from '@agilebox/core'
import type { ProjectModuleSetting, UnitOfWorkRepositories } from '../../ports'
import type { GuideProgressEntry } from '../../ports/guide-progress-repository'
import { GUIDE_CARD_KEY } from '../../ports/guide-progress-repository'

/** Repositórios que o serviço do guia lê e grava. Batem com `AppDeps` e com a `UnitOfWork`. */
export type GuideRecordPorts = Pick<
  UnitOfWorkRepositories,
  'projects' | 'projectModules' | 'users' | 'guideProgress'
>

const CORE: ModuleId = 'core'

/** Módulos que valem para a trilha: o núcleo sempre, e os módulos do projeto com estado `active`. */
export function activeGuideModules(rows: readonly ProjectModuleSetting[]): ModuleId[] {
  return [
    CORE,
    ...rows
      .filter((row) => row.state === 'active' && row.moduleId !== CORE)
      .map((row) => row.moduleId),
  ]
}

/** Chaves dos passos concluídos (a linha da dispensa do cartão não é passo: `doneAt` é nulo). */
export function doneStepKeys(entries: readonly GuideProgressEntry[]): Set<string> {
  return new Set(
    entries
      .filter((entry) => entry.doneAt !== null && entry.stepKey !== GUIDE_CARD_KEY)
      .map((entry) => entry.stepKey),
  )
}

/**
 * Registra um evento de alimentação para a pessoa e conclui sozinhos os passos que ele fecha
 * (ADR-10). Serviço interno: não é caso de uso exposto e não passa pelo guard. Nunca lança por
 * falta de projeto, de pessoa ou de módulo: nesses casos não faz nada. Chamado pelos casos de uso
 * que geram o evento, dentro da própria transação, com os repositórios dela.
 */
export async function recordGuideEvent(
  ports: GuideRecordPorts,
  actor: Actor,
  projectId: ProjectId,
  event: GuideEventType,
  at: string,
): Promise<void> {
  const organizationId = actor.organizationId
  const project = await ports.projects.findById(organizationId, projectId)
  if (!project) return
  const person = await ports.users.findById(organizationId, actor.userId)
  if (!person) return

  const rows = await ports.projectModules.list(organizationId, projectId)
  const trail = buildGuideTrail(activeGuideModules(rows))
  if (trail.length === 0) return

  const done = doneStepKeys(
    await ports.guideProgress.listForUser(organizationId, projectId, actor.userId),
  )
  const keys = completeStepsOnEvent(trail, done, event)
  if (keys.length === 0) return

  await ports.guideProgress.markDone(organizationId, projectId, actor.userId, keys, at)
}
