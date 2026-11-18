import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, EmptyState, TaskKey } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { todayDateOnly } from '../../shared/lib/today'
import { ActiveBoard } from '../sprints/ActiveBoard'
import { sprintCopy } from '../sprints/sprint-copy'
import { arrowRange, midSprintTaskIds, sumHours } from '../sprints/sprint-rules'
import {
  refreshSprintsEverywhere,
  useSprintDetail,
  useSprintItemMutations,
} from '../sprints/use-sprints'
import { hoursText } from '../sprints/SprintItems'
import { buildSprintContext, planCopy, type SprintContextItem } from './plan-screen'
import { usePlanData } from './use-plan'
import styles from './PlanSprintView.module.css'

export interface PlanSprintViewProps {
  readonly projectId: string
  readonly sprintId: string
  /** Entrega de topo em que a sprint está aberta; nulo quando a sprint não tem itens de entrega. */
  readonly deliverableId: string | null
  readonly showEstimates: boolean
  /** Volta ao plano (tela 17), pela trilha "Entrega 1 ›" no topo. */
  readonly onBack: () => void
  readonly onOpenTask: (taskId: string) => void
  /** Abre o diálogo de nova tarefa (o mesmo do topo da janela). */
  readonly onNewTask?: () => void
}

/**
 * Sprint dentro da entrega (tela 18): o quadro da sprint com o contexto da entrega (progresso, marco
 * e meta), o selo de entrega em cada cartão e o aviso de item que não é da entrega. Usa o quadro da
 * tela de Sprints; ações de encerrar e editar ficam na própria tela de Sprints.
 */
export function PlanSprintView({
  projectId,
  sprintId,
  deliverableId,
  showEstimates,
  onBack,
  onOpenTask,
  onNewTask,
}: PlanSprintViewProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const capabilities = useCapabilities()
  const data = usePlanData(projectId)
  const detail = useSprintDetail(sprintId)
  const items = useSprintItemMutations()
  const sendBack = useMutation({
    mutationFn: (taskId: string) => api.backlog.sendBack({ taskId }),
    onSettled: () => refreshSprintsEverywhere(queryClient),
  })
  const windingDown = capabilities.isWindingDown('sprints')

  const sprint = detail.data?.sprint ?? data.sprints.find((entry) => entry.id === sprintId) ?? null
  const sprintItems = useMemo(() => detail.data?.items ?? [], [detail.data])
  const history = detail.data?.history ?? []

  const context = useMemo(() => {
    if (!data.wbs || !sprint) return null
    return buildSprintContext({
      wbs: data.wbs,
      sprint,
      sprints: data.sprints,
      itemsById: data.itemsById,
      items: sprintItems,
      deliverableId,
      today: todayDateOnly(),
    })
  }, [data.wbs, data.sprints, data.itemsById, sprint, sprintItems, deliverableId])

  if (detail.isPending || data.isPending) {
    return (
      <section aria-label={sprintCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {sprintCopy.loading}
        </p>
      </section>
    )
  }

  if (detail.isError || data.isError || !sprint || !context) {
    return (
      <section aria-label={sprintCopy.title} className={styles.view}>
        <EmptyState title={sprintCopy.error} />
      </section>
    )
  }

  const midSprint = midSprintTaskIds(history, sprint)
  const hours = sumHours(sprintItems).estimated
  const outside = context.outside
  const tagById = new Map<string, SprintContextItem>(
    context.items.map((entry) => [entry.item.id, entry]),
  )
  const deliverable = context.deliverable

  return (
    <section aria-label={sprintCopy.title} className={styles.view}>
      <header className={styles.header}>
        {deliverable ? (
          <nav aria-label="Caminho" className={styles.crumb}>
            <button type="button" className={styles.crumbLink} onClick={onBack}>
              {deliverable.label}
            </button>
            <span aria-hidden="true">›</span>
          </nav>
        ) : null}
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{sprint.label}</h2>
          <span className={styles.dates}>
            {arrowRange(sprint.plannedStart, sprint.plannedEnd)}
            {context.dayText ? ` · ${context.dayText}` : ''}
          </span>
          <span className={styles.spacer} />
          {windingDown || !onNewTask ? null : (
            <Button type="button" variant="primary" onClick={onNewTask}>
              {sprintCopy.newTask}
            </Button>
          )}
        </div>
      </header>

      <section aria-label="Contexto" className={styles.context}>
        <div className={styles.contextCell}>
          <span className={styles.label}>
            {deliverable ? `Entrega ${deliverable.code}` : 'Entrega'}
          </span>
          {deliverable ? (
            <>
              <span className={styles.progressLine}>
                <span aria-hidden="true" className={styles.track}>
                  <span className={styles.fill} style={{ width: `${deliverable.progress}%` }} />
                </span>
                <span className={styles.mono}>{deliverable.progress}%</span>
              </span>
              <span className={styles.note}>
                {planCopy.sprintsOfDeliverable(deliverable.sprintsText)}
              </span>
            </>
          ) : (
            <span className={styles.note}>{planCopy.noDeliverableContext}</span>
          )}
        </div>
        <div className={styles.contextCell}>
          <span className={styles.label}>{planCopy.milestoneLabel}</span>
          <span className={styles.strong}>{deliverable?.milestone ?? planCopy.noMilestone}</span>
        </div>
        <div className={styles.contextCell}>
          <span className={styles.label}>{sprintCopy.goalTitle}</span>
          <span className={styles.strong}>{sprint.goal ?? sprintCopy.noGoal}</span>
          <span className={styles.mono}>
            {showEstimates ? planCopy.plannedHours(hoursText(hours)) : null}
          </span>
        </div>
      </section>

      {outside.length > 0 ? (
        <section role="alert" aria-labelledby="plan-outside" className={styles.alert}>
          <div className={styles.alertText}>
            <h3 id="plan-outside" className={styles.alertTitle}>
              {planCopy.outsideTitle(outside.length)}
            </h3>
            <span className={styles.alertBody}>{planCopy.outsideText(outside.length)}</span>
          </div>
          {outside.map((task) => (
            <div key={task.id} className={styles.outsideRow}>
              <TaskKey value={task.key} />
              <span className={styles.outsideTitle}>{task.title}</span>
              {windingDown ? null : (
                <Button
                  type="button"
                  aria-label={`Devolver ${task.title} ao backlog`}
                  disabled={sendBack.isPending}
                  onClick={() => sendBack.mutate(task.id)}
                >
                  Devolver ao backlog
                </Button>
              )}
            </div>
          ))}
        </section>
      ) : null}

      <ActiveBoard
        items={sprintItems}
        midSprint={midSprint}
        showEstimates={showEstimates}
        removeDisabled={items.remove.isPending}
        onOpenTask={onOpenTask}
        onRemove={(taskId) => items.remove.mutate({ sprintId: sprint.id, taskId })}
        cardTag={(task) => {
          const entry = tagById.get(task.id)
          if (!entry) return null
          return (
            <span
              className={`${styles.tag} ${entry.outside && deliverableId !== null ? styles.tagOutside : styles.tagInside}`}
            >
              {entry.tag}
            </span>
          )
        }}
      />
    </section>
  )
}
