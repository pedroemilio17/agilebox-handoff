import { getManifest, listManifests, type ModuleId } from '@agilebox/core'
import type { GuideViewDto, ProjectModuleDto } from '@agilebox/contract'

/**
 * Conteúdo do painel "Como funciona" de um módulo: texto do manifesto e as ligações com os outros
 * módulos, com o estado de cada um no projeto. Função pura: não fala com a API nem com a tela.
 *
 * "Requer" e "aproveita" vêm do manifesto do módulo. "Alimenta" é calculado: são os módulos cujo
 * `requires` ou `enhances` contém este módulo.
 */

export type ModuleHelpLinkKind = 'requer' | 'aproveita' | 'alimenta'

export interface ModuleHelpLink {
  readonly kind: ModuleHelpLinkKind
  readonly moduleId: ModuleId
  /** Nome na interface, do manifesto. */
  readonly name: string
  /** Ligado no projeto (estado `active`). Encerrando conta como desligado. */
  readonly on: boolean
}

export interface ModuleHelp {
  readonly name: string
  /** "N2 · intermediário", ou `null` no núcleo (que não tem nível). */
  readonly levelLabel: string | null
  readonly objective: string
  readonly why: string
  readonly flow: readonly string[]
  /** Ordem: requer, aproveita, alimenta. */
  readonly links: readonly ModuleHelpLink[]
  /** "Seu guia" do projeto, ou `null` enquanto o guia não chegou. */
  readonly experience: GuideViewDto['experience'] | null
}

const LEVEL_LABELS: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'N1 · essencial',
  2: 'N2 · intermediário',
  3: 'N3 · avançado',
}

/** Rótulos de "Seu guia" (experiência), como o guia os guarda. */
export const EXPERIENCE_LABELS: Readonly<Record<GuideViewDto['experience'], string>> = {
  never: 'Nunca',
  sometimes: 'Algumas vezes',
  always: 'Sempre',
}

/**
 * Monta o painel de ajuda de um módulo. `modulesState` é a lista de `projectModules.get`; módulo
 * que não está na lista conta como desligado.
 */
export function moduleHelp(
  moduleId: ModuleId,
  modulesState: readonly ProjectModuleDto[],
  experience: GuideViewDto['experience'] | null,
): ModuleHelp {
  const manifest = getManifest(moduleId)
  const activeIds = new Set(
    modulesState.filter((module) => module.state === 'active').map((module) => module.id),
  )
  const linkTo = (kind: ModuleHelpLinkKind, id: ModuleId): ModuleHelpLink => ({
    kind,
    moduleId: id,
    name: getManifest(id).name,
    on: activeIds.has(id),
  })

  const requer = manifest.requires.map((id) => linkTo('requer', id))
  const aproveita = manifest.enhances.map((id) => linkTo('aproveita', id))
  const alimenta = listManifests()
    .filter(
      (other) =>
        other.id !== moduleId &&
        (other.requires.includes(moduleId) || other.enhances.includes(moduleId)),
    )
    .map((other) => linkTo('alimenta', other.id))

  return {
    name: manifest.name,
    levelLabel: manifest.level === null ? null : LEVEL_LABELS[manifest.level],
    objective: manifest.objective,
    why: manifest.tutorial.why,
    flow: manifest.tutorial.flow,
    links: [...requer, ...aproveita, ...alimenta],
    experience,
  }
}
