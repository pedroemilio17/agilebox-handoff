import { deadlineLabel, parseDateOnly } from '@agilebox/core'
import type { DateOnly } from '@agilebox/core'
import type { GetTaskDto, TaskUpdateInput } from '@agilebox/contract'
import { PropertyRow } from './PropertyRow'
import { panelCopy } from '../copy'
import { useBlurSave } from './use-blur-save'
import styles from './TaskDetailView.module.css'

export interface DeadlineCardProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  readonly today: DateOnly
  readonly onUpdate: (changes: TaskUpdateInput['changes']) => void
}

export function DeadlineCard({ task, readOnly, today, onUpdate }: DeadlineCardProps) {
  const deadline = useBlurSave(task.deadline ?? '', (next) =>
    onUpdate({ deadline: next === '' ? null : next }),
  )
  const current = task.deadline === null ? null : parseDateOnly(task.deadline)

  return (
    <PropertyRow label={panelCopy.deadlineCard}>
      <input
        type="date"
        className={styles.kvInput}
        aria-label={panelCopy.deadline}
        disabled={readOnly}
        value={deadline.value}
        onChange={(event) => deadline.onChange(event.currentTarget.value)}
        onFocus={deadline.onFocus}
        onBlur={deadline.onBlur}
      />
      <span className={styles.kvHint} data-testid="deadline-label">
        {deadlineLabel(task.status, current, today)}
      </span>
    </PropertyRow>
  )
}
