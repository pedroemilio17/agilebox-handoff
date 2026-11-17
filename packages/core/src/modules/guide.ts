import { ValidationError } from '../shared/errors'
import type { UserId } from '../shared/ids'
import { getManifest } from './manifest'
import type { GuideEventType, GuideStep } from './manifest'
import { getModule, MODULE_IDS } from './registry'
import type { ModuleId } from './registry'

/**
 * Guia de alimentação (ADR-10). A trilha é gerada pelos manifestos: os módulos ligados entram em
 * ordem de dependência, e os passos de cada um seguem na ordem do manifesto. Nenhum passo é
 * pré-condição de outro: o guia nunca bloqueia.
 */

export interface GuideTrailStep extends GuideStep {
  readonly moduleId: ModuleId
  /** Nome do módulo na interface ("Backlog"). */
  readonly moduleName: string
  /** Título do passo seguinte da trilha, o "O que vem depois". `null` no último. */
  readonly next: string | null
}

export interface GuideProgress {
  readonly done: number
  readonly total: number
  /** Primeiro passo ainda não concluído, na ordem da trilha. */
  readonly current: GuideTrailStep | null
}

export type GuideExperience = 'never' | 'sometimes' | 'always'

export interface GuideIntensity {
  /** Cartão "Primeiros passos" na tela inicial. */
  readonly firstStepsCard: 'open' | 'collapsed' | 'hidden'
  /** Estado vazio: explicação completa com exemplo, ou uma frase. */
  readonly emptyState: 'full' | 'short'
  /** Dicas da primeira vez em cada tela. */
  readonly firstTimeHints: boolean
  /** Explica o jargão (EAP, sprint, WIP) ao lado do termo. */
  readonly explainJargon: boolean
}

const CATALOG_INDEX: ReadonlyMap<ModuleId, number> = new Map(
  MODULE_IDS.map((id, index) => [id, index]),
)

/**
 * Pré-requisitos de um módulo entre os ligados. `requiresAnyOf` conta todas as alternativas
 * ligadas: o módulo sempre vem depois de qualquer uma delas que esteja na trilha.
 */
function enabledPrerequisites(id: ModuleId, enabled: ReadonlySet<ModuleId>): ModuleId[] {
  const definition = getModule(id)
  const candidates = [...definition.requires, ...(definition.requiresAnyOf ?? []).flat()]
  return [...new Set(candidates)].filter((candidate) => candidate !== id && enabled.has(candidate))
}

/**
 * Ordem topológica dos módulos ligados. Empate: o primeiro do catálogo (`MODULE_IDS`) vem antes,
 * então a saída depende só do conjunto, não da ordem de entrada.
 */
function orderModules(enabled: readonly ModuleId[]): ModuleId[] {
  const known = new Set(enabled.filter((id) => CATALOG_INDEX.has(id)))
  const pending = [...known].sort((a, b) => catalogIndex(a) - catalogIndex(b))
  const prerequisites = new Map(pending.map((id) => [id, enabledPrerequisites(id, known)]))

  const order: ModuleId[] = []
  const placed = new Set<ModuleId>()
  while (order.length < pending.length) {
    const next = pending.find(
      (id) =>
        !placed.has(id) &&
        (prerequisites.get(id) ?? []).every((prerequisite) => placed.has(prerequisite)),
    )
    if (!next) throw new ValidationError('Ciclo nas dependências dos módulos')
    placed.add(next)
    order.push(next)
  }
  return order
}

function catalogIndex(id: ModuleId): number {
  return CATALOG_INDEX.get(id) ?? Number.MAX_SAFE_INTEGER
}

/**
 * Trilha do guia para os módulos ligados. Módulo sem passos não aparece; ids fora do catálogo são
 * ignorados. Só-núcleo gera trilha vazia.
 */
export function buildGuideTrail(enabled: readonly ModuleId[]): GuideTrailStep[] {
  const steps = orderModules(enabled).flatMap((moduleId) => {
    const manifest = getManifest(moduleId)
    return manifest.steps.map((step) => ({
      key: step.key,
      title: step.title,
      why: step.why,
      doneWhen: step.doneWhen,
      moduleId,
      moduleName: manifest.name,
    }))
  })

  return steps.map((step, index) => ({
    ...step,
    next: steps[index + 1]?.title ?? null,
  }))
}

/** Progresso da trilha. Passos concluídos fora de ordem contam; chaves fora da trilha são ignoradas. */
export function guideProgress(
  trail: readonly GuideTrailStep[],
  doneKeys: ReadonlySet<string>,
): GuideProgress {
  return {
    done: trail.filter((step) => doneKeys.has(step.key)).length,
    total: trail.length,
    current: trail.find((step) => !doneKeys.has(step.key)) ?? null,
  }
}

/**
 * Chaves dos passos pendentes cujo `doneWhen` é o evento. O passo se conclui sozinho quando a
 * pessoa faz a ação; todos os pendentes com esse evento concluem juntos, na ordem da trilha.
 */
export function completeStepsOnEvent(
  trail: readonly GuideTrailStep[],
  doneKeys: ReadonlySet<string>,
  event: GuideEventType,
): string[] {
  return trail
    .filter((step) => !doneKeys.has(step.key) && step.doneWhen === event)
    .map((step) => step.key)
}

const INTENSITY: Readonly<Record<GuideExperience, GuideIntensity>> = Object.freeze({
  never: Object.freeze({
    firstStepsCard: 'open',
    emptyState: 'full',
    firstTimeHints: true,
    explainJargon: true,
  }),
  sometimes: Object.freeze({
    firstStepsCard: 'collapsed',
    emptyState: 'short',
    firstTimeHints: false,
    explainJargon: false,
  }),
  always: Object.freeze({
    firstStepsCard: 'hidden',
    emptyState: 'short',
    firstTimeHints: false,
    explainJargon: false,
  }),
})

/** Intensidade do guia para uma experiência com o guia. */
export function guideIntensity(experience: GuideExperience): GuideIntensity {
  return INTENSITY[experience]
}

/**
 * Experiência efetiva com o guia. A do projeto prevalece; a da pessoa vale quando o projeto não
 * definiu; sem nenhuma, o padrão é `never`.
 */
export function resolveGuideExperience(
  project: GuideExperience | null | undefined,
  person: GuideExperience | null | undefined,
): GuideExperience {
  return project ?? person ?? 'never'
}

/**
 * Janela de boas-vindas (ADR-10): a única exceção à regra de o guia não usar modais. Mostra-se para
 * a pessoa quando TODAS as condições valem:
 *  1. ela é membro do projeto (o gestor que não é membro nunca vê);
 *  2. ela não criou o projeto;
 *  3. ela entrou depois da criação (`addedAt` estritamente posterior a `createdAt`; quem entrou no
 *     mesmo instante da criação, que é o criador, não vê);
 *  4. a trilha do projeto não é vazia (projeto Simples não tem o que mostrar);
 *  5. ela ainda não respondeu à janela (`answered`, guardado com a chave reservada).
 */
export function isWelcomeDue(input: {
  readonly actorUserId: UserId
  readonly project: { readonly createdBy: UserId; readonly createdAt: string }
  readonly member: { readonly addedAt: string } | null
  readonly trailSteps: number
  readonly answered: boolean
}): boolean {
  const { actorUserId, project, member, trailSteps, answered } = input
  if (member === null) return false
  if (project.createdBy === actorUserId) return false
  if (!(Date.parse(member.addedAt) > Date.parse(project.createdAt))) return false
  if (trailSteps === 0) return false
  return !answered
}
