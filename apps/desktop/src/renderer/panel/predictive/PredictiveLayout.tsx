import { useState, type ReactNode } from 'react'
import type { PanelView } from '../layout/PanelShell'
import type { TopicTabItem } from '../layout/project-nav'
import { PageHead, TopicLayout } from '../settings/clean-ui'
import type { RailGroup, RailItem } from '../settings/clean-ui'
import { PredictiveKpis } from './PredictiveKpis'
import { RailCounts, type RailCountMap } from './RailCounts'
import {
  predictiveGroupLabel,
  predictiveSubtitle,
  predictiveTitle,
  railLabelOf,
  showsPredictiveKpis,
  SPRINT_TOPIC_TEXT,
  SPRINT_TOPICS,
} from './predictive-rules'
import { SprintTopicContext, type SprintTab } from './sprint-topic'
import styles from './PredictiveLayout.module.css'

export interface PredictiveLayoutProps {
  /** Nome do grupo (Entregas, Cronograma ou Sprints), usado no rótulo do rail. */
  readonly ariaLabel: string
  readonly items: readonly TopicTabItem<PanelView>[]
  readonly activeId: PanelView
  readonly onSelect: (id: PanelView) => void
  readonly projectId: string | null
  readonly children: ReactNode
}

const SPRINT_PREFIX = 'sprints:'

/**
 * Casca dos fluxos com rail (protótipos `preditivo.html` e `agil.html`): cabeçalho de página com
 * título e subtítulo por tópico, rail de tópicos de 188px com contadores e coluna única. Cada tópico
 * segue sendo a tela que já existe; só a moldura é comum. No grupo de Sprints, a tela de Sprints vira
 * três tópicos (Sprint ativa, Planejamento, Encerradas).
 */
export function PredictiveLayout({
  ariaLabel,
  items,
  activeId,
  onSelect,
  projectId,
  children,
}: PredictiveLayoutProps) {
  const [sprintTab, setSprintTab] = useState<SprintTab>('active')
  const views = items.map((item) => item.id)
  const [counts, setCounts] = useState<RailCountMap>({})

  const railItems: RailItem<string>[] = items.flatMap((item): RailItem<string>[] =>
    item.id === 'sprints'
      ? SPRINT_TOPICS.map((topic) => ({
          id: `${SPRINT_PREFIX}${topic.tab}`,
          label: topic.label,
        }))
      : [
          {
            id: item.id,
            label: railLabelOf(item.id, item.label),
            count: counts[item.id] ?? item.count ?? undefined,
          },
        ],
  )
  const groups: RailGroup<string>[] = [{ label: predictiveGroupLabel(views), items: railItems }]
  const activeRailId = activeId === 'sprints' ? `${SPRINT_PREFIX}${sprintTab}` : activeId

  const isSprintTopic = activeId === 'sprints'
  const title = isSprintTopic ? SPRINT_TOPIC_TEXT[sprintTab].title : predictiveTitle(activeId)
  const subtitle = isSprintTopic
    ? SPRINT_TOPIC_TEXT[sprintTab].subtitle
    : predictiveSubtitle(activeId)
  const isSprintGroup = views.includes('sprints')

  const body = (
    <>
      {projectId !== null && showsPredictiveKpis(activeId) ? (
        <PredictiveKpis projectId={projectId} />
      ) : null}
      {children}
    </>
  )

  return (
    <div className={styles.layout}>
      <RailCounts projectId={projectId} views={views} onCounts={setCounts} />
      {title ? <PageHead title={title} {...(subtitle ? { subtitle } : {})} /> : null}
      <SprintTopicContext.Provider value={{ tab: sprintTab, setTab: setSprintTab }}>
        {items.length > 1 ? (
          <TopicLayout<string>
            ariaLabel={ariaLabel}
            groups={groups}
            activeId={activeRailId}
            stageWidth={isSprintGroup ? 'full' : 840}
            onSelect={(id) => {
              if (id.startsWith(SPRINT_PREFIX)) {
                setSprintTab(id.slice(SPRINT_PREFIX.length) as SprintTab)
                onSelect('sprints')
                return
              }
              onSelect(id as PanelView)
            }}
          >
            {body}
          </TopicLayout>
        ) : (
          <div className={styles.single}>{body}</div>
        )}
      </SprintTopicContext.Provider>
    </div>
  )
}
