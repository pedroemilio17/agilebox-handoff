import { useId, useState } from 'react'
import type { SprintDto, TaskDto } from '@agilebox/contract'
import { Button, Modal } from '@agilebox/ui'
import { closeSummary } from './sprint-rules'
import { sprintCopy } from './sprint-copy'
import styles from './SprintsView.module.css'

export type ClosePolicyChoice =
  | { readonly policy: 'return_to_backlog' }
  | { readonly policy: 'carry_over'; readonly nextSprintId: string }

export interface CloseSprintDialogProps {
  readonly open: boolean
  readonly sprint: SprintDto
  readonly items: readonly TaskDto[]
  /** Rascunhos do mesmo projeto que podem receber os itens abertos. */
  readonly targets: readonly SprintDto[]
  readonly windingDown: boolean
  readonly busy: boolean
  readonly error: string | null
  readonly onCancel: () => void
  readonly onConfirm: (choice: ClosePolicyChoice) => void
}

/**
 * Encerrar a sprint: resumo e a política para os itens abertos. Devolver ao backlog é o padrão.
 * "Levar para a próxima" exige um rascunho do projeto e some do caminho quando o módulo encerra.
 */
export function CloseSprintDialog({
  open,
  sprint,
  items,
  targets,
  windingDown,
  busy,
  error,
  onCancel,
  onConfirm,
}: CloseSprintDialogProps) {
  const groupId = useId()
  const summary = closeSummary(items)
  const carryAvailable = !windingDown && targets.length > 0
  const [policy, setPolicy] = useState<'return_to_backlog' | 'carry_over'>('return_to_backlog')
  const [chosenTarget, setChosenTarget] = useState<string>('')
  const nextId = targets.find((target) => target.id === chosenTarget)?.id ?? targets[0]?.id ?? ''
  const carrying = policy === 'carry_over' && carryAvailable
  const confirmDisabled = busy || (carrying && nextId === '')

  return (
    <Modal open={open} title={sprintCopy.closeTitle} onClose={onCancel}>
      <form
        className={styles.dialog}
        onSubmit={(event) => {
          event.preventDefault()
          if (confirmDisabled) return
          onConfirm(
            carrying
              ? { policy: 'carry_over', nextSprintId: nextId }
              : { policy: 'return_to_backlog' },
          )
        }}
      >
        <h3 className={styles.sectionHeading}>
          {sprintCopy.closeTitle} · {sprint.label}
        </h3>
        <p className={styles.summary}>
          {sprintCopy.closeSummary(summary.done, summary.open, summary.started)}
        </p>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{sprintCopy.closePolicyLegend}</legend>

          <label className={styles.option}>
            <input
              type="radio"
              name={`${groupId}-policy`}
              value="return_to_backlog"
              checked={policy === 'return_to_backlog'}
              onChange={() => setPolicy('return_to_backlog')}
            />
            <span>
              <strong>{sprintCopy.policyReturn}</strong>
              <span className={styles.hint}>{sprintCopy.policyReturnHelp}</span>
            </span>
          </label>

          <label className={styles.option}>
            <input
              type="radio"
              name={`${groupId}-policy`}
              value="carry_over"
              checked={policy === 'carry_over'}
              disabled={!carryAvailable}
              onChange={() => setPolicy('carry_over')}
            />
            <span>
              <strong>{sprintCopy.policyCarry}</strong>
              <span className={styles.hint}>{sprintCopy.policyCarryHelp}</span>
            </span>
          </label>

          {carryAvailable ? null : (
            <p className={styles.hint}>
              {windingDown ? sprintCopy.windingDownNoCreate : sprintCopy.noDraftForCarry}
            </p>
          )}

          {carrying ? (
            <label className={styles.field}>
              <span className={styles.label}>{sprintCopy.nextSprintLabel}</span>
              <select
                className={styles.select}
                value={nextId}
                onChange={(event) => setChosenTarget(event.currentTarget.value)}
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label} · {target.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>

        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={confirmDisabled}>
            {sprintCopy.closeConfirm}
          </Button>
          <Button type="button" onClick={onCancel} disabled={busy}>
            {sprintCopy.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
