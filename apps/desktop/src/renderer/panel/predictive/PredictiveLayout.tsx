import type { ReactNode } from 'react'
import type { PanelView } from '../layout/PanelShell'
import type { TopicTabItem } from '../layout/project-nav'
import { PredictiveKpis } from './PredictiveKpis'
import { predictiveSubtitle, showsPredictiveKpis } from './predictive-rules'
import styles from './PredictiveLayout.module.css'

export interface PredictiveLayoutProps {
  /** Nome do grupo (Entregas ou Cronograma), usado no rótulo do rail. */
  readonly ariaLabel: string
  readonly items: readonly TopicTabItem<PanelView>[]
  readonly activeId: PanelView
  readonly onSelect: (id: PanelView) => void
  readonly projectId: string | null
  readonly children: ReactNode
}

/**
 * Casca do Fluxo Preditivo (protótipo `preditivo.html`, `.topic-layout`): rail de tópicos à esquerda,
 * subtítulo e indicadores no topo do conteúdo. A tela de cada tópico segue a mesma, só muda o
 * conteúdo: a EAP, os riscos, o cronograma, os marcos e o plano salvo já existem como telas.
 */
export function PredictiveLayout({
  ariaLabel,
  items,
  activeId,
  onSelect,
  projectId,
  children,
}: PredictiveLayoutProps) {
  const subtitle = predictiveSubtitle(activeId)
  return (
    <div className={styles.layout}>
      {items.length > 1 ? (
        <nav aria-label={ariaLabel} className={styles.rail}>
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.tab} ${active ? styles.active : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      ) : null}
      <div className={styles.stage}>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {projectId !== null && showsPredictiveKpis(activeId) ? (
          <PredictiveKpis projectId={projectId} />
        ) : null}
        {children}
      </div>
    </div>
  )
}
