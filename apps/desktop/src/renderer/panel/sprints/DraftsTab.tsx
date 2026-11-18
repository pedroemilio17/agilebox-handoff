import { useState } from 'react'
import { sprintLabel } from '@agilebox/core'
import type { SprintDto, TaskDto } from '@agilebox/contract'
import { AddButton, Button, EmptyState, Modal } from '@agilebox/ui'
import { refusalMessage } from '../backlog/refusal-message'
import { SprintForm } from './SprintForm'
import { BacklogPicker, hoursText, SprintItemRow } from './SprintItems'
import { sprintCopy } from './sprint-copy'
import { sumHours } from './sprint-rules'
import type { SprintFormValues } from './sprint-rules'
import {
  useCreateSprint,
  useDiscardSprint,
  useSprintDetail,
  useSprintItemMutations,
  useStartSprint,
  useUpdateSprint,
} from './use-sprints'
import styles from './SprintsView.module.css'

export interface DraftsTabProps {
  readonly projectId: string
  readonly drafts: readonly SprintDto[]
  readonly windingDown: boolean
  readonly showEstimates: boolean
  readonly onOpenTask: (taskId: string) => void
  /** Sprint iniciada: a tela muda para a aba Ativa, com essa sprint. */
  readonly onStarted: (sprintId: string) => void
  readonly onNotify: (message: string) => void
  /** Rascunho a abrir quando a aba é mostrada (ex.: o que acabou de ser replanejado). */
  readonly preferredId?: string | null
}

/** Aba Planejamento: rascunhos do projeto, com criação, edição, descarte, itens e início. */
export function DraftsTab({
  projectId,
  drafts,
  windingDown,
  showEstimates,
  onOpenTask,
  onStarted,
  onNotify,
  preferredId = null,
}: DraftsTabProps) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const selectedId =
    drafts.find((draft) => draft.id === chosenId)?.id ??
    drafts.find((draft) => draft.id === preferredId)?.id ??
    drafts[0]?.id ??
    null
  const detail = useSprintDetail(selectedId)
  const create = useCreateSprint(projectId)
  const update = useUpdateSprint()
  const start = useStartSprint()
  const discard = useDiscardSprint()
  const items = useSprintItemMutations()

  const sprint = detail.data?.sprint
  const sprintItems: readonly TaskDto[] = detail.data?.items ?? []
  const hours = sumHours(sprintItems)

  const submitCreate = (values: SprintFormValues) => {
    setFormError(null)
    create.mutate(
      {
        name: values.name.trim(),
        goal: values.goal.trim() === '' ? null : values.goal.trim(),
        plannedStart: values.plannedStart,
        plannedEnd: values.plannedEnd,
      },
      {
        onSuccess: (created) => {
          setCreating(false)
          setChosenId(created.sprint.id)
          onNotify(`${created.sprint.label} criada como rascunho.`)
        },
        onError: (error) => setFormError(refusalMessage(error, 'Não foi possível criar a sprint.')),
      },
    )
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

  const startSprint = () => {
    if (!sprint) return
    setDetailError(null)
    start.mutate(sprint.id, {
      onSuccess: () => {
        onNotify(sprintCopy.startDone)
        onStarted(sprint.id)
      },
      onError: (error) => setDetailError(refusalMessage(error, sprintCopy.startError)),
    })
  }

  const confirmDiscard = () => {
    if (!sprint) return
    discard.mutate(
      { sprintId: sprint.id, returnToBacklog: sprintItems.length > 0 },
      {
        onSuccess: () => {
          setDiscarding(false)
          setChosenId(null)
          onNotify(`${sprint.label} descartada.`)
        },
        onError: (error) => {
          setDiscarding(false)
          setDetailError(refusalMessage(error, sprintCopy.discardError))
        },
      },
    )
  }

  const addItem = (task: TaskDto) => {
    if (!sprint) return
    setDetailError(null)
    items.add.mutate(
      { sprintId: sprint.id, taskId: task.id },
      {
        onSuccess: () => onNotify(`${task.title} adicionado à sprint.`),
        onError: (error) => setDetailError(refusalMessage(error, sprintCopy.addItemError)),
      },
    )
  }

  const removeItem = (taskId: string) => {
    if (!sprint) return
    setDetailError(null)
    items.remove.mutate(
      { sprintId: sprint.id, taskId },
      { onError: (error) => setDetailError(refusalMessage(error, sprintCopy.removeItemError)) },
    )
  }

  const busy = create.isPending || update.isPending
  return (
    <div className={styles.tab}>
      {windingDown ? <p className={styles.helper}>{sprintCopy.windingDownNotice}</p> : null}

      <div className={styles.toolbarRow}>
        <h2 className={styles.sectionHeading}>{sprintCopy.draftsTitle}</h2>
        {windingDown ? null : (
          <AddButton
            type="button"
            onClick={() => {
              setFormError(null)
              setCreating(true)
            }}
          >
            {sprintCopy.newSprint}
          </AddButton>
        )}
      </div>

      {creating ? (
        <section className={styles.panel} aria-label={sprintCopy.newSprint}>
          <p className={styles.hint}>{sprintCopy.newSprintHelp}</p>
          <SprintForm
            initial={{ name: '', goal: '', plannedStart: '', plannedEnd: '' }}
            submitLabel={sprintCopy.formCreate}
            busy={busy}
            error={formError}
            onSubmit={submitCreate}
            onCancel={() => setCreating(false)}
          />
        </section>
      ) : null}

      {drafts.length === 0 && !creating ? (
        <EmptyState title={sprintCopy.draftsEmpty} description={sprintCopy.draftsEmptyHint} />
      ) : null}

      {drafts.length > 0 ? (
        <ul className={styles.draftList} aria-label={sprintCopy.draftsTitle}>
          {drafts.map((draft) => (
            <li key={draft.id}>
              <button
                type="button"
                className={styles.draftButton}
                aria-pressed={draft.id === selectedId}
                aria-label={sprintCopy.draftSelect(draft.label)}
                onClick={() => {
                  setChosenId(draft.id)
                  setEditing(false)
                  setDetailError(null)
                }}
              >
                <span className={styles.itemTitle}>{draft.name}</span>
                <span className={styles.meta}>
                  {draft.label} · {formatRange(draft.plannedStart, draft.plannedEnd)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedId && detail.isPending ? (
        <p role="status" className={styles.hint}>
          {sprintCopy.loading}
        </p>
      ) : null}
      {selectedId && detail.isError ? (
        <div role="alert" className={styles.errorBox}>
          <p>{sprintCopy.error}</p>
          <Button type="button" onClick={() => void detail.refetch()}>
            {sprintCopy.retry}
          </Button>
        </div>
      ) : null}

      {sprint && !creating ? (
        <section className={styles.panel} aria-label={sprint.name}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>{sprintLabel(sprint.number)}</p>
              <h3 className={styles.sprintName}>{sprint.name}</h3>
              {sprint.goal ? <p className={styles.goal}>{sprint.goal}</p> : null}
              <p className={styles.meta}>{formatRange(sprint.plannedStart, sprint.plannedEnd)}</p>
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
              <Button type="button" onClick={() => setDiscarding(true)}>
                {sprintCopy.discard}
              </Button>
              {windingDown ? null : (
                <Button
                  type="button"
                  variant="primary"
                  disabled={start.isPending}
                  onClick={startSprint}
                >
                  {sprintCopy.start}
                </Button>
              )}
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

          {detailError ? (
            <p role="alert" className={styles.error}>
              {detailError}
            </p>
          ) : null}

          <h4 className={styles.sectionTitle}>{sprintCopy.items}</h4>
          {showEstimates && sprintItems.length > 0 ? (
            <p className={styles.meta}>{sprintCopy.estimatedTotal(hoursText(hours.estimated))}</p>
          ) : null}
          {sprintItems.length === 0 ? (
            <p className={styles.hint}>
              {sprintCopy.noItems} {sprintCopy.noItemsDraftHint}
            </p>
          ) : (
            <ul className={styles.list}>
              {sprintItems.map((task) => (
                <SprintItemRow
                  key={task.id}
                  task={task}
                  midSprint={false}
                  onOpen={onOpenTask}
                  onRemove={removeItem}
                />
              ))}
            </ul>
          )}

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

      <Modal
        open={discarding && sprint !== undefined}
        title={sprintCopy.discardTitle}
        onClose={() => setDiscarding(false)}
      >
        <div className={styles.dialog}>
          <h3 className={styles.sectionHeading}>{sprintCopy.discardTitle}</h3>
          <p className={styles.hint}>
            {sprintCopy.discardBody}
            {sprintItems.length > 0 ? ` ${sprintCopy.discardWithItems}` : ''}
          </p>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="primary"
              disabled={discard.isPending}
              onClick={confirmDiscard}
            >
              {sprintCopy.discardConfirm}
            </Button>
            <Button type="button" onClick={() => setDiscarding(false)}>
              {sprintCopy.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/** Intervalo de datas planejadas em pt-BR, como "10/11 a 21/11". */
export function formatRange(start: string, end: string): string {
  return `${shortDate(start)} a ${shortDate(end)}`
}

/** Data de calendário em pt-BR, dia e mês (ex.: "21/11"). */
export function shortDate(date: string): string {
  const [, month, day] = date.slice(0, 10).split('-')
  return `${day}/${month}`
}
