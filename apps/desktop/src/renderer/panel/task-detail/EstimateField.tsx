import { useState } from 'react'
import type { GetTaskDto } from '@agilebox/contract'
import { ApiError } from '@agilebox/contract'
import { formatBRL } from '@agilebox/core'
import { PropertyRow } from './PropertyRow'
import { taskDetailCopy } from './copy'
import { formatEstimateInput, parseEstimateInput } from './estimate-input'
import { useBlurSave } from './use-blur-save'
import { useSetEstimate } from './use-estimate'
import styles from './TaskDetailView.module.css'

export interface EstimateFieldProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
}

/**
 * Estimativa em horas, separada do realizado (ADR-07, D13). Grava ao sair do campo. O custo
 * estimado aparece só quando o DTO o trouxe: a tela não calcula a partir das horas.
 */
export function EstimateField({ task, readOnly }: EstimateFieldProps) {
  const save = useSetEstimate(task.id)
  const [problem, setProblem] = useState<string | null>(null)
  const field = useBlurSave(formatEstimateInput(task.estimatedHours), (next) => {
    const parsed = parseEstimateInput(next)
    if (!parsed.ok) {
      setProblem(parsed.message)
      return
    }
    setProblem(null)
    if (parsed.hours !== task.estimatedHours) save.mutate(parsed.hours)
  })

  const saveFailure = save.error
    ? save.error instanceof ApiError && save.error.code === 'FORBIDDEN'
      ? taskDetailCopy.estimateForbidden
      : taskDetailCopy.estimateSaveError
    : null
  const message = problem ?? saveFailure

  return (
    <PropertyRow label={taskDetailCopy.estimateLabel}>
      <div className={styles.propertyContent}>
        <div className={styles.costRow}>
          <input
            aria-label={taskDetailCopy.estimateField}
            className={styles.numberInput}
            inputMode="decimal"
            disabled={readOnly}
            value={field.value}
            onChange={(event) => field.onChange(event.currentTarget.value)}
            onFocus={field.onFocus}
            onBlur={field.onBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
          />
          <span className={styles.helper}>{taskDetailCopy.estimateUnit}</span>
        </div>
        {task.estimatedCost === null ? null : (
          <div className={styles.costRow}>
            <span className={styles.grow}>{taskDetailCopy.estimatedCost}</span>
            <output aria-label={taskDetailCopy.estimatedCost}>
              {formatBRL(Math.round(task.estimatedCost * 100))}
            </output>
          </div>
        )}
        {message ? <p role="alert">{message}</p> : null}
      </div>
    </PropertyRow>
  )
}
