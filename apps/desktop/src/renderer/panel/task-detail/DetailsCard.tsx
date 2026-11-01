import { useState } from 'react'
import type { GetTaskDto, TaskUpdateInput } from '@agilebox/contract'
import type { TaskStatus } from '@agilebox/core'
import { FieldRow, GlassSurface, GroupedList, StatusChip, StatusMenu, TextArea } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { useBlurSave } from './use-blur-save'
import styles from './TaskDetailView.module.css'

export interface DetailsCardProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  readonly onUpdate: (changes: TaskUpdateInput['changes']) => void
  readonly onMove: (status: TaskStatus) => void
}

function isUrl(text: string): boolean {
  try {
    return new URL(text).protocol.startsWith('http')
  } catch {
    return false
  }
}

export function DetailsCard({ task, readOnly, onUpdate, onMove }: DetailsCardProps) {
  const [statusOpen, setStatusOpen] = useState(false)
  const description = useBlurSave(task.description, (next) => onUpdate({ description: next }))
  const ticketId = useBlurSave(task.ticketId === null ? '' : String(task.ticketId), (next) =>
    onUpdate(next === '' ? { ticketId: null, ticketUrl: null } : { ticketId: Number(next) }),
  )
  const ticketUrl = useBlurSave(task.ticketUrl ?? '', (next) => {
    if (next === '') onUpdate({ ticketUrl: null })
    else if (isUrl(next)) onUpdate({ ticketUrl: next })
  })
  const responsible = task.participations
    .filter((participation) => participation.role === 'responsible')
    .map((participation) => participation.participantName)
    .join(', ')
  const urlInvalid = ticketUrl.value !== '' && !isUrl(ticketUrl.value)

  return (
    <GlassSurface variant="group" className={styles.card} aria-label={panelCopy.detailsCard}>
      <h3 className={styles.cardTitle}>{panelCopy.detailsCard}</h3>
      <TextArea
        label={panelCopy.description}
        placeholder={panelCopy.descriptionPlaceholder}
        disabled={readOnly}
        value={description.value}
        onChange={(event) => description.onChange(event.currentTarget.value)}
        onFocus={description.onFocus}
        onBlur={description.onBlur}
      />
      <GroupedList>
        <FieldRow label={panelCopy.status}>
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
        </FieldRow>
        <FieldRow label={panelCopy.responsible}>
          <span>{responsible || panelCopy.noResponsible}</span>
        </FieldRow>
        <FieldRow label={panelCopy.ticket}>
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
        </FieldRow>
      </GroupedList>
    </GlassSurface>
  )
}
