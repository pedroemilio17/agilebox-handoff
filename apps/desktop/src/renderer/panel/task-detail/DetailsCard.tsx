import type { GetTaskDto, TaskUpdateInput } from '@agilebox/contract'
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from '@agilebox/core'
import type { TaskPriority } from '@agilebox/core'
import { panelCopy } from '../copy'
import { PropertyRow } from './PropertyRow'
import { taskCopy } from './task-detail-copy'
import { useBlurSave } from './use-blur-save'
import styles from './TaskDetailView.module.css'

interface PropertyProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  readonly onUpdate: (changes: TaskUpdateInput['changes']) => void
}
function isUrl(text: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

export function PriorityProperty({ task, readOnly, onUpdate }: PropertyProps) {
  return (
    <PropertyRow label={panelCopy.priority}>
      <select
        aria-label={panelCopy.priorityLevel}
        className={styles.kvSelect}
        disabled={readOnly}
        value={task.priority}
        // Escolha de lista salva na hora (não ao sair do campo, como o texto).
        onChange={(event) => onUpdate({ priority: event.currentTarget.value as TaskPriority })}
      >
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {TASK_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>
    </PropertyRow>
  )
}

export function TicketProperty({ task, readOnly, onUpdate }: PropertyProps) {
  const ticketId = useBlurSave(task.ticketId === null ? '' : String(task.ticketId), (next) =>
    onUpdate(next === '' ? { ticketId: null, ticketUrl: null } : { ticketId: Number(next) }),
  )
  const ticketUrl = useBlurSave(task.ticketUrl ?? '', (next) => {
    if (next === '') onUpdate({ ticketUrl: null })
    else if (isUrl(next)) onUpdate({ ticketUrl: next })
  })
  const urlInvalid = ticketUrl.value !== '' && !isUrl(ticketUrl.value)
  return (
    <PropertyRow label={panelCopy.ticket}>
      <div className={styles.kvStack}>
        <input
          aria-label={panelCopy.ticketId}
          className={styles.kvInput}
          inputMode="numeric"
          disabled={readOnly}
          value={ticketId.value}
          onChange={(event) => ticketId.onChange(event.currentTarget.value.replace(/\D/g, ''))}
          onFocus={ticketId.onFocus}
          onBlur={ticketId.onBlur}
        />
        <input
          aria-label={panelCopy.ticketUrl}
          aria-invalid={urlInvalid}
          className={styles.kvInput}
          placeholder="https://"
          disabled={readOnly || ticketId.value === ''}
          value={ticketUrl.value}
          onChange={(event) => ticketUrl.onChange(event.currentTarget.value.trim())}
          onFocus={ticketUrl.onFocus}
          onBlur={ticketUrl.onBlur}
        />
      </div>
    </PropertyRow>
  )
}

/** Descrição: grava ao sair do campo e também pelo botão "Salvar texto". */
export function TaskDescription({ task, readOnly, onUpdate }: PropertyProps) {
  const description = useBlurSave(task.description, (next) => onUpdate({ description: next }))
  return (
    <section className={styles.topicSection} aria-labelledby="task-section-desc">
      <div className={styles.topicSectionHead}>
        <h2 className={styles.topicSectionTitle} id="task-section-desc">
          {taskCopy.description}
        </h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          disabled={readOnly}
          // Ao clicar o campo perde o foco e já grava; o clique cobre o caso sem foco.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (description.value !== task.description) onUpdate({ description: description.value })
          }}
        >
          {taskCopy.saveDescription}
        </button>
      </div>
      <textarea
        className={styles.cleanTextarea}
        rows={3}
        aria-label={taskCopy.descriptionAria}
        placeholder={panelCopy.descriptionPlaceholder}
        disabled={readOnly}
        value={description.value}
        onChange={(event) => description.onChange(event.currentTarget.value)}
        onFocus={description.onFocus}
        onBlur={description.onBlur}
      />
    </section>
  )
}
