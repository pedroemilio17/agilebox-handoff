import type { ReactNode } from 'react'
import { getManifest, type ModuleId } from '@agilebox/core'
import { EmptyState } from '@agilebox/ui'
import { useGuide } from '../hooks/use-guide'
import { emptyStateCopy } from './empty-state-copy'

export interface ModuleEmptyStateProps {
  readonly moduleId: ModuleId
  /** Sem projeto selecionado, vale o texto de `fallbackTitle` e `fallbackDescription`. */
  readonly projectId: string | null
  /** Texto usado enquanto o guia carrega, com erro ou sem projeto. */
  readonly fallbackTitle: string
  readonly fallbackDescription?: string
  /** Ação opcional do estado vazio, por exemplo um botão. */
  readonly children?: ReactNode
}

/**
 * Estado vazio de uma tela de módulo. O texto vem do manifesto do módulo, na intensidade do guia da
 * pessoa. Some sozinho quando a tela tem dados: quem decide é a tela, que só o renderiza vazio.
 */
export function ModuleEmptyState({
  moduleId,
  projectId,
  fallbackTitle,
  fallbackDescription,
  children,
}: ModuleEmptyStateProps) {
  const guide = useGuide(projectId)
  const copy = emptyStateCopy(
    projectId === null ? null : getManifest(moduleId),
    guide.data?.intensity.emptyState,
    {
      title: fallbackTitle,
      ...(fallbackDescription !== undefined ? { description: fallbackDescription } : {}),
    },
  )
  return (
    <EmptyState
      title={copy.title}
      {...(copy.description !== undefined ? { description: copy.description } : {})}
      action={children}
    />
  )
}
