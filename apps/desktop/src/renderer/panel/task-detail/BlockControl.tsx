import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { GetTaskDto } from '@agilebox/contract'
import { Button, SignalBadge, TextArea } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { SaveError } from './SaveError'
import { useBlockTask, useUnblockTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

/** Mesmo limite do contrato (`taskBlockReasonSchema`). */
const BLOCK_REASON_MAX_LENGTH = 280

export interface BlockControlProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
}

/** Validação do motivo: obrigatório e até 280 caracteres (sem contar espaços das pontas). */
export function validateBlockReasonInput(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return panelCopy.blockReasonRequired
  if (Array.from(trimmed).length > BLOCK_REASON_MAX_LENGTH) return panelCopy.blockReasonTooLong
  return null
}

export function BlockControl({ task, readOnly }: BlockControlProps) {
  const taskId = task.id
  const block = useBlockTask(taskId)
  const unblock = useUnblockTask(taskId)
  const capabilities = useCapabilities()
  // Módulo desligado: nenhum efeito, nem o motivo. Só com a tela ligada há bloquear e desbloquear.
  const showBlocked = capabilities.can('impediments:passive')
  const showActions = capabilities.can('impediments:screen')
  const [formOpen, setFormOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const countId = `${fieldId}-count`

  if (task.blockedReason !== null) {
    if (!showBlocked) return null
    // Sem a tela de impedimentos, o motivo aparece como informação, sem o botão Desbloquear.
    return (
      <section aria-label={panelCopy.blockedSection} className={styles.blockStrip}>
        <p>
          <SignalBadge variant="blocked">Bloqueada</SignalBadge>
          <span>{task.blockedReason}</span>
        </p>
        {showActions ? (
          <>
            <Button
              type="button"
              disabled={readOnly || unblock.isPending}
              onClick={() => unblock.mutate()}
            >
              {panelCopy.unblockAction}
            </Button>
            <SaveError error={unblock.error} />
          </>
        ) : null}
      </section>
    )
  }

  // Concluída não bloqueia: o servidor também limpa o bloqueio ao concluir.
  if (!showActions || task.status === 'done') return null

  if (!formOpen) {
    return (
      <div className={styles.blockAction}>
        <Button type="button" disabled={readOnly} onClick={() => setFormOpen(true)}>
          {panelCopy.blockAction}
        </Button>
        <SaveError error={block.error} />
      </div>
    )
  }

  const count = Array.from(reason).length
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = validateBlockReasonInput(reason)
    setError(message)
    if (message) return
    block.mutate(reason.trim(), {
      onSuccess: () => {
        setReason('')
        setFormOpen(false)
      },
    })
  }

  return (
    <form
      aria-label={panelCopy.blockAction}
      className={styles.blockForm}
      noValidate
      onSubmit={submit}
    >
      <TextArea
        label={panelCopy.blockReasonLabel}
        rows={2}
        value={reason}
        aria-invalid={error !== null}
        aria-describedby={`${countId} ${errorId}`}
        onChange={(event) => {
          setReason(event.currentTarget.value)
          if (error) setError(validateBlockReasonInput(event.currentTarget.value))
        }}
      />
      <div className={styles.blockFooter}>
        <span
          id={countId}
          className={count > BLOCK_REASON_MAX_LENGTH ? styles.blockCountOver : styles.blockCount}
        >
          {count}/{BLOCK_REASON_MAX_LENGTH}
        </span>
        {error ? (
          <p id={errorId} role="alert" className={styles.blockError}>
            {error}
          </p>
        ) : null}
      </div>
      <div className={styles.blockButtons}>
        <Button type="submit" variant="primary" disabled={block.isPending}>
          {panelCopy.blockConfirm}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setFormOpen(false)
            setReason('')
            setError(null)
          }}
        >
          {panelCopy.blockCancel}
        </Button>
      </div>
      <SaveError error={block.error} />
    </form>
  )
}
