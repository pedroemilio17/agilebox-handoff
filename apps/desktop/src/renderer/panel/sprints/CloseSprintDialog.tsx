import { useId, useState, type ReactNode } from 'react'
import type { SprintDto, TaskDto } from '@agilebox/contract'
import { Button, Modal } from '@agilebox/ui'
import { hoursText } from './SprintItems'
import { shortDate } from './DraftsTab'
import { sprintCopy } from './sprint-copy'
import { sumHours } from './sprint-rules'
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
  /** Retrospectiva da sprint (combinados), na coluna da direita. Sem ela, o diálogo tem uma coluna. */
  readonly retro?: ReactNode
  readonly onCancel: () => void
  readonly onConfirm: (choice: ClosePolicyChoice) => void
}

const RETURN_VALUE = 'return_to_backlog'
const CARRY_PREFIX = 'carry:'

/**
 * Encerrar a sprint (design "Encerrar", à esquerda): itens e horas concluídos, o destino dos itens
 * abertos e a velocidade que fica registrada. A retrospectiva entra à direita, quando há.
 * Devolver ao backlog é o padrão. "Levar para a próxima" exige um rascunho do projeto.
 */
export function CloseSprintDialog({
  open,
  sprint,
  items,
  targets,
  windingDown,
  busy,
  error,
  retro,
  onCancel,
  onConfirm,
}: CloseSprintDialogProps) {
  const selectId = useId()
  const doneItems = items.filter((item) => item.status === 'done')
  const openItems = items.filter((item) => item.status !== 'done')
  const doneHours = sumHours(doneItems).estimated
  const totalHours = sumHours(items).estimated
  const carryAvailable = !windingDown && targets.length > 0
  const [choice, setChoice] = useState<string>(RETURN_VALUE)
  const selected = carryAvailable
    ? (targets.find((target) => `${CARRY_PREFIX}${target.id}` === choice)?.id ?? null)
    : null
  const carrying = selected !== null
  const confirmDisabled = busy

  return (
    <Modal
      open={open}
      title={sprintCopy.closeTitle}
      onClose={onCancel}
      size={retro ? 'wide' : 'default'}
    >
      <form
        className={retro ? styles.closeLayoutWide : styles.closeLayout}
        onSubmit={(event) => {
          event.preventDefault()
          if (confirmDisabled) return
          onConfirm(
            carrying && selected !== null
              ? { policy: 'carry_over', nextSprintId: selected }
              : { policy: 'return_to_backlog' },
          )
        }}
      >
        <div className={styles.closeMain}>
          <header className={styles.closeHeader}>
            <h2 className={styles.closeTitle}>{sprintCopy.closeTitle}</h2>
            <span className={styles.closeMeta}>
              {sprint.label} · {shortDate(sprint.plannedEnd)}
            </span>
          </header>

          <div className={styles.closeTiles}>
            <div className={styles.closeTile}>
              <span className={styles.closeTileLabel}>{sprintCopy.closeTileItems}</span>
              <span className={styles.closeTileValue}>
                {doneItems.length} <span>de {items.length}</span>
              </span>
            </div>
            <div className={styles.closeTile}>
              <span className={styles.closeTileLabel}>{sprintCopy.closeTileHours}</span>
              <span className={styles.closeTileValue}>
                {hoursText(doneHours)} h <span>de {hoursText(totalHours)} h</span>
              </span>
            </div>
          </div>

          {openItems.length > 0 ? (
            <section className={styles.closeOpen} aria-labelledby={`${selectId}-open`}>
              <div className={styles.closeOpenHeader}>
                <h3 id={`${selectId}-open`} className={styles.closeOpenTitle}>
                  {sprintCopy.closeOpenItems(openItems.length)}
                </h3>
                <label className={styles.closeDestination}>
                  <span className={styles.srOnly}>{sprintCopy.closeDestination}</span>
                  <select
                    id={selectId}
                    className={styles.select}
                    value={carrying ? `${CARRY_PREFIX}${selected}` : RETURN_VALUE}
                    onChange={(event) => setChoice(event.currentTarget.value)}
                  >
                    <option value={RETURN_VALUE}>{sprintCopy.policyReturn}</option>
                    {carryAvailable
                      ? targets.map((target) => (
                          <option key={target.id} value={`${CARRY_PREFIX}${target.id}`}>
                            {sprintCopy.policyCarry}: {target.label} · {target.name}
                          </option>
                        ))
                      : null}
                  </select>
                </label>
              </div>
              <ul className={styles.closeOpenList}>
                {openItems.map((item) => (
                  <li key={item.id} className={styles.closeOpenRow}>
                    <span className={styles.closeKey}>{item.key}</span>
                    <span className={styles.closeOpenName}>{item.title}</span>
                    <span className={styles.closeKey}>{hoursText(item.estimatedHours ?? 0)} h</span>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>
                {carrying ? sprintCopy.policyCarryHelp : sprintCopy.policyReturnHelp}
              </p>
              {carryAvailable ? null : (
                <p className={styles.hint}>
                  {windingDown ? sprintCopy.windingDownNoCreate : sprintCopy.noDraftForCarry}
                </p>
              )}
            </section>
          ) : null}

          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}

          <footer className={styles.closeFooter}>
            <p className={styles.closeVelocity}>
              {sprintCopy.closeVelocity(sprint.number, hoursText(doneHours))}
            </p>
            <Button type="button" onClick={onCancel} disabled={busy}>
              {sprintCopy.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={confirmDisabled}>
              {sprintCopy.closeConfirm}
            </Button>
          </footer>
        </div>
        {retro}
      </form>
    </Modal>
  )
}
