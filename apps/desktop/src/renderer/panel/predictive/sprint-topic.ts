import { createContext, useContext } from 'react'

export type SprintTab = 'draft' | 'active' | 'closed'

export interface SprintTopicValue {
  readonly tab: SprintTab
  readonly setTab: (tab: SprintTab) => void
}

/**
 * Quando a casca do rail (PredictiveLayout) envolve a tela de Sprints, ela é dona do tópico
 * (Sprint ativa, Planejamento, Encerradas). Sem a casca, a tela usa o próprio estado.
 */
export const SprintTopicContext = createContext<SprintTopicValue | null>(null)

export const useSprintTopic = () => useContext(SprintTopicContext)
