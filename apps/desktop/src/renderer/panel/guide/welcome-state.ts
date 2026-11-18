import type { GuideViewDto } from '@agilebox/contract'
import { welcomeCopy } from './welcome-copy'

/**
 * Regras puras da janela de boas-vindas: quando aparece e o texto que mostra. Não fala com a API
 * nem com a tela.
 */

export interface WelcomeStep {
  readonly key: string
  readonly title: string
  readonly moduleName: string
}

export interface WelcomeState {
  readonly visible: boolean
  readonly title: string
  readonly intro: string
  readonly stepCount: number
  readonly steps: readonly WelcomeStep[]
}

const HIDDEN: WelcomeState = {
  visible: false,
  title: '',
  intro: '',
  stepCount: 0,
  steps: [],
}

/** Primeiro nome da pessoa, ou `null` quando não há nome. */
export function firstName(personName: string | undefined): string | null {
  const first = personName?.trim().split(/\s+/)[0]
  return first ? first : null
}

/**
 * Decide a janela a partir do DTO do guia. Aparece só com `showWelcome`, com o bloco `welcome` e
 * com trilha não vazia. O `personName` entra no título pelo primeiro nome.
 */
export function getWelcomeState(
  guide: GuideViewDto | undefined,
  personName?: string,
): WelcomeState {
  if (guide === undefined) return HIDDEN
  const { welcome } = guide
  if (!guide.showWelcome || welcome === null || guide.trail.length === 0) return HIDDEN

  const intro =
    welcome.presetLabel !== null
      ? welcomeCopy.presetIntro(welcome.presetLabel, welcome.moduleCount)
      : welcomeCopy.plainIntro(welcome.moduleCount)

  return {
    visible: true,
    title: welcomeCopy.title(welcome.projectName, firstName(personName)),
    intro,
    stepCount: guide.trail.length,
    steps: guide.trail.map((step) => ({
      key: step.key,
      title: step.title,
      moduleName: step.moduleName,
    })),
  }
}
