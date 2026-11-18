import { useState } from 'react'
import { sprintLabel, TASK_STATUSES, TASK_STATUS_LABELS } from '@agilebox/core'
import type { SprintDto, TaskDto } from '@agilebox/contract'
import { Button, EmptyState, ProgressBar } from '@agilebox/ui'
import { refusalMessage } from '../backlog/refusal-message'
import type { PanelView } from '../layout/PanelShell'
import { CloseSprintDialog, type ClosePolicyChoice } from './CloseSprintDialog'
import { SprintForm } from './SprintForm'
import { BacklogPicker, hoursText, SprintItemRow } from './SprintItems'
import { CeremonyButtons } from './CeremonyButtons'
import { formatRange, shortDate } from './DraftsTab'
import { sprintCopy } from './sprint-copy'
import { carryTargets, groupByStatus, midSprintTaskIds, progressOf, sumHours } from './sprint-rules'
import type { SprintFormValues } from './sprint-rules'
import {
  useCloseSprint,
  useSprintDetail,
  useSprintItemMutations,
  useSprintList,
  useUpdateSprint,
} from './use-sprints'
import styles from './SprintsView.module.css'

export interface ActiveTabProps {
  readonly projectId: string
  readonly actives: readonly SprintDto[]
  readonly windingDown: boolean
  readonly showEstimates: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onNotify: (message: string) => void
  /** Gestor com Agenda e Cerimônias ligadas: mostra os atalhos de planning, review e retro. */
  readonly ceremoniesVisible?: boolean
  readonly onNavigate?: (view: PanelView) => void
}

/** Aba Ativa: a sprint em andamento, com progresso, mini-quadro, itens e encerramento. */
export function ActiveTab({
  projectId,
  actives,
  windingDown,
  showEstimates,
  onOpenTask,
  onNotify,
  ceremoniesVisible = false,
  onNavigate,
}: ActiveTabProps) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const selectedId = actives.find((sprint) => sprint.id === chosenId)?.id ?? actives[0]?.id ?? null
  const detail = useSprintDetail(selectedId)
  const allSprints = useSprintList(projectId)
  const update = useUpdateSprint()
  const close = useCloseSprint()
  const items = useSprintItemMutations()
  const [editing, setEditing] = useState(false)
  const [closing, setClosing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [itemError, setItemError] = useState<string | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)

  const sprint = detail.data?.sprint
  const sprintItems: readonly TaskDto[] = detail.data?.items ?? []
  const history = detail.data?.history ?? []
  const midSprint = sprint ? midSprintTaskIds(history, sprint) : new Set<string>()
  const progress = progressOf(sprintItems)
  const hours = sumHours(sprintItems)
  const groups = groupByStatus(sprintItems)
  const targets = sprint ? carryTargets(allSprints.data ?? [], projectId, sprint.id) : []

  if (actives.length === 0) {
    return <EmptyState title={sprintCopy.activeEmpty} description={sprintCopy.activeEmptyHint} />
  }

  const submitEdit = (values: SprintFormValues) => {
    if (!sprint) return
    setFormError(null)
    update.mutate(
      {
        sprintId: sprint.id,
        name: values.name.trim(),
        goal: values.goal.trim() === '' ? null : values.goal.trim(),
        plannedStart: values.plannedStart,
        plannedEnd: values.plannedEnd,
      },
      {
        onSuccess: () => {
          setEditing(false)
          onNotify(sprintCopy.saved)
        },
        onError: (error) => setFormError(refusalMessage(error, sprintCopy.saveError)),
      },
    )
  }

  const addItem = (task: TaskDto) => {
    if (!sprint) return
    setItemError(null)
    items.add.mutate(
      { sprintId: sprint.id, taskId: task.id },
      {
        onSuccess: () => onNotify(sprintCopy.addedMidSprintNotice(task.title)),
        onError: (error) => setItemError(refusalMessage(error, sprintCopy.addItemError)),
      },
    )
  }

  const removeItem = (taskId: string) => {
    if (!sprint) return
    setItemError(null)
    items.remove.mutate(
      { sprintId: sprint.id, taskId },
      { onError: (error) => setItemError(refusalMessage(error, sprintCopy.removeItemError)) },
    )
  }

  const confirmClose = (choice: ClosePolicyChoice) => {
    if (!sprint) return
    setCloseError(null)
    close.mutate(
      choice.policy === 'carry_over'
        ? { sprintId: sprint.id, policy: 'carry_over', nextSprintId: choice.nextSprintId }
        : { sprintId: sprint.id, policy: 'return_to_backlog' },
      {
        onSuccess: () => {
          setClosing(false)
          onNotify(sprintCopy.closed)
        },
        // Recusa do domínio (ex.: sprint seguinte que deixou de ser rascunho) fica no diálogo.
        onError: (error) => setCloseError(refusalMessage(error, sprintCopy.closeError)),
      },
    )
  }

  return (
    <div className={styles.tab}>
      {actives.length > 1 ? (
        <ul className={styles.draftList} aria-label={sprintCopy.activeTitle}>
          {actives.map((active) => (
            <li key={active.id}>
              <button
                type="button"
                className={styles.draftButton}
                aria-pressed={active.id === selectedId}
                aria-label={sprintCopy.draftSelect(active.label)}
                onClick={() => {
                  setChosenId(active.id)
                  setEditing(false)
                }}
              >
                <span className={styles.itemTitle}>{active.name}</span>
                <span className={styles.meta}>{active.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {windingDown ? <p className={styles.helper}>{sprintCopy.windingDownNotice}</p> : null}

      {sprint ? (
        <section className={styles.panel} aria-label={sprint.name}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>{sprintLabel(sprint.number)}</p>
              <h3 className={styles.sprintName}>{sprint.name}</h3>
              {sprint.goal ? <p className={styles.goal}>{sprint.goal}</p> : null}
              <p className={styles.meta}>
                {formatRange(sprint.plannedStart, sprint.plannedEnd)}
                {sprint.startedAt ? ` · ${sprintCopy.startedOn(shortDate(sprint.startedAt))}` : ''}
              </p>
            </div>
            <div className={styles.actions}>
              <Button
                type="button"
                onClick={() => {
                  setFormError(null)
                  setEditing((open) => !open)
                }}
              >
                {sprintCopy.edit}
              </Button>
              <Button type="button" variant="primary" onClick={() => setClosing(true)}>
                {sprintCopy.close}
              </Button>
            </div>
          </header>

          {editing ? (
            <SprintForm
              initial={{
                name: sprint.name,
                goal: sprint.goal ?? '',
                plannedStart: sprint.plannedStart,
                plannedEnd: sprint.plannedEnd,
              }}
              submitLabel={sprintCopy.save}
              busy={update.isPending}
              error={formError}
              onSubmit={submitEdit}
              onCancel={() => setEditing(false)}
            />
          ) : null}

          <div className={styles.progress}>
            <ProgressBar
              done={progress.done}
              total={progress.total}
              label={sprintCopy.progress(progress.done, progress.total)}
            />
            <p className={styles.meta}>{sprintCopy.progress(progress.done, progress.total)}</p>
            {showEstimates && (hours.estimated > 0 || hours.actual > 0) ? (
              <p className={styles.meta}>
                {sprintCopy.hoursEstimatedActual(
                  hoursText(hours.estimated),
                  hoursText(hours.actual),
                )}
              </p>
            ) : null}
          </div>

          {ceremoniesVisible ? (
            <CeremonyButtons
              key={sprint.id}
              sprint={sprint}
              projectId={projectId}
              onNotify={onNotify}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ) : null}

          {itemError ? (
            <p role="alert" className={styles.error}>
              {itemError}
            </p>
          ) : null}

          <div className={styles.miniBoard} aria-label={sprintCopy.items}>
            {TASK_STATUSES.map((status) => (
              <section
                key={status}
                className={styles.column}
                aria-label={TASK_STATUS_LABELS[status]}
              >
                <h4 className={styles.columnTitle}>
                  {TASK_STATUS_LABELS[status]}
                  <span className={styles.count}>{groups[status].length}</span>
                </h4>
                {groups[status].length === 0 ? (
                  <p className={styles.hint}>{sprintCopy.noColumnItems}</p>
                ) : (
                  <ul className={styles.list}>
                    {groups[status].map((task) => (
                      <SprintItemRow
                        key={task.id}
                        task={task}
                        midSprint={midSprint.has(task.id)}
                        onOpen={onOpenTask}
                        onRemove={removeItem}
                        removeDisabled={items.remove.isPending}
                      />
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {windingDown ? null : (
            <BacklogPicker
              projectId={projectId}
              sprintId={sprint.id}
              excludeTaskIds={new Set(sprintItems.map((task) => task.id))}
              busy={items.add.isPending}
              onAdd={addItem}
            />
          )}
        </section>
      ) : null}

      {sprint ? (
        <CloseSprintDialog
          open={closing}
          sprint={sprint}
          items={sprintItems}
          targets={targets}
          windingDown={windingDown}
          busy={close.isPending}
          error={closeError}
          onCancel={() => setClosing(false)}
          onConfirm={confirmClose}
        />
      ) : null}
    </div>
  )
}
