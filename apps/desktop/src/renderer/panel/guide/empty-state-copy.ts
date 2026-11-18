import type { ModuleManifest } from '@agilebox/core'

/**
 * Título e descrição de um estado vazio de módulo (ADR-10, "Estado vazio"). Função pura: decide o
 * texto a partir do manifesto do módulo e da intensidade do guia da pessoa.
 *
 * Sem manifesto ou sem intensidade (guia ainda carregando, com erro ou sem projeto), vale o texto de
 * `fallback`: o guia nunca atrapalha a tela. Com intensidade `full` (nível "Nunca") a descrição é a
 * explicação com exemplo; com `short` só a frase.
 */

export type EmptyStateIntensity = 'full' | 'short'

export interface EmptyStateFallback {
  readonly title: string
  readonly description?: string
}

export interface EmptyStateCopy {
  readonly title: string
  /** `undefined` quando o estado vazio mostra só o título. */
  readonly description: string | undefined
}

export function emptyStateCopy(
  manifest: Pick<ModuleManifest, 'emptyState'> | null,
  intensity: EmptyStateIntensity | undefined,
  fallback: EmptyStateFallback,
): EmptyStateCopy {
  if (manifest === null || intensity === undefined) {
    return { title: fallback.title, description: fallback.description }
  }
  return {
    title: manifest.emptyState.short,
    description: intensity === 'full' ? manifest.emptyState.full : undefined,
  }
}
