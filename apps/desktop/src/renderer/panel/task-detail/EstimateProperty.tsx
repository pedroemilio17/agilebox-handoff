import { useId, useState } from 'react'
import type { GetTaskDto } from '@agilebox/contract'
import { formatBRL, formatHours } from '@agilebox/core'
import { panelCopy } from '../copy'
import { PropertyRow } from './PropertyRow'
import { SaveError } from './SaveError'
import { parseEstimateInput } from './estimate-input'
import { useSetEstimate } from './use-task-detail'
import styles from './TaskDetailView.module.css'

export interface EstimatePropertyProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
}

/** Estimativa em horas com o realizado ao lado. O custo estimado só aparece quando o servidor o devolve. */
export function EstimateProperty({ task, readOnly }: EstimatePropertyProps) {
  const setEstimate = useSetEstimate(task.id)
  const hintId = useId()
  const errorId = useId()
  // `null` = não está editando; senão, o texto digitado até o blur ou o Enter.
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const estimated = task.estimatedHours ?? null
  const shown = draft ?? (estimated === null ? '' : String(estimated).replace('.', ','))

  function save() {
    const parsed = parseEstimateInput(shown)
    if (!parsed.ok) {
      setError(panelCopy.estimateInvalid)
      return
    }
    setError(null)
    if (parsed.hours === estimated) {
      setDraft(null)
      return
    }
    setEstimate.mutate(parsed.hours, { onSettled: () => setDraft(null) })
  }

  const actual = Math.round((task.actualHours ?? 0) * 100)
  return (
    <PropertyRow label={panelCopy.estimateLabel}>
      <div className={styles.kvStack}>
        <input
          aria-label={panelCopy.estimateLabel}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : hintId}
          className={styles.kvInput}
          inputMode="decimal"
          disabled={readOnly}
          value={shown}
          onChange={(event) => {
            setDraft(event.currentTarget.value)
            if (error) setError(null)
          }}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
          }}
        />
        <p id={hintId} className={styles.kvHint}>
          {panelCopy.estimateHint}
        </p>
        {error ? (
          <p id={errorId} role="alert" className={styles.errorNote}>
            {error}
          </p>
        ) : null}
        <output className={styles.kvEstimate}>
          {estimated === null
            ? `${panelCopy.estimateNone} · ${formatHours(actual)} realizado`
            : panelCopy.estimateVsActual(
                formatHours(Math.round(estimated * 100)),
                formatHours(actual),
              )}
        </output>
        {task.estimatedCost === undefined || task.estimatedCost === null ? null : (
          <p className={styles.kvEstimate}>
            <span>{panelCopy.estimateCost}</span>
            <output aria-label={panelCopy.estimateCost}>
              {formatBRL(Math.round(task.estimatedCost * 100))}
            </output>
          </p>
        )}
        <SaveError error={setEstimate.error} />
      </div>
    </PropertyRow>
  )
}
