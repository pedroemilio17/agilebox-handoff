import { useState } from 'react'
import type { GetTaskDto, TaskUpdateInput } from '@agilebox/contract'
import type { TaskStatus } from '@agilebox/core'
import { StatusChip, StatusMenu, TextArea } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { PropertyRow } from './PropertyRow'
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

export function StatusProperty({
  task,
  readOnly,
  onMove,
}: {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  readonly onMove: (status: TaskStatus) => void
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  return (
    <PropertyRow label={panelCopy.status}>
      {' '}
      <div className={styles.menuAnchor}>
        <button
          type="button"
          className={styles.statusButton}
          aria-haspopup="menu"
          aria-expanded={statusOpen}
          aria-label={panelCopy.status}
          disabled={readOnly}
          onClick={() => setStatusOpen((open) => !open)}
        >
          <StatusChip status={task.status} />
        </button>
        {statusOpen ? (
          <div className={styles.menuPopover}>
            <StatusMenu
              value={task.status}
              onChange={onMove}
              onClose={() => setStatusOpen(false)}
            />
          </div>
        ) : null}
      </div>
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
      <div className={styles.ticketFields}>
        {' '}
        <input
          aria-label={panelCopy.ticketId}
          className={styles.inlineInput}
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
          className={styles.inlineInput}
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

export function TaskDescription({ task, readOnly, onUpdate }: PropertyProps) {
  const description = useBlurSave(task.description, (next) => onUpdate({ description: next }))
  return (
    <section className={styles.descriptionSection}>
      {' '}
      <TextArea
        label={panelCopy.description}
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
