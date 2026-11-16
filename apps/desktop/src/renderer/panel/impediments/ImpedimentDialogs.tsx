import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { ImpedimentListItemDto } from '@agilebox/contract'
import { Button, Modal, TextArea } from '@agilebox/ui'
import { refusalMessage } from '../backlog/refusal-message'
import { useSessionUsers } from '../hooks/use-session-users'
import { useTaskDetail } from '../task-detail/use-task-detail'
import { impedimentCopy } from './impediment-copy'
import {
  ownerCandidates,
  ownerIdFromSelect,
  ownerValue,
  RESOLUTION_MAX_LENGTH,
  validateResolutionInput,
} from './impediment-rules'
import { useAssignImpediment, useResolveImpediment } from './use-impediments'
import styles from './ImpedimentsView.module.css'

export interface ImpedimentDialogProps {
  readonly impediment: ImpedimentListItemDto
  readonly onClose: () => void
  /** Chamado depois de gravar, com o aviso da tela. */
  readonly onDone: (message: string) => void
}

/**
 * Atribuir responsável. Quem pode: participantes da tarefa e o gestor (o servidor confere). A lista
 * vem do detalhe da tarefa; "Sem responsável" limpa o campo.
 */
export function AssignDialog({ impediment, onClose, onDone }: ImpedimentDialogProps) {
  const detail = useTaskDetail(impediment.taskId)
  const users = useSessionUsers()
  const assign = useAssignImpediment()
  const [value, setValue] = useState(ownerValue(impediment.ownerId))
  const selectId = useId()

  const candidates = ownerCandidates(detail.data, users.data ?? [])
  // Responsável atual que deixou de participar segue na lista, para não sumir da seleção.
  const options =
    impediment.ownerId !== null &&
    impediment.ownerName !== null &&
    !candidates.some((candidate) => candidate.id === impediment.ownerId)
      ? [...candidates, { id: impediment.ownerId, name: impediment.ownerName }]
      : candidates
  const loading = detail.isPending || users.isPending

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    assign.mutate(
      { impedimentId: impediment.id, ownerId: ownerIdFromSelect(value) },
      {
        onSuccess: () => {
          onDone(impedimentCopy.assignDone)
          onClose()
        },
      },
    )
  }

  return (
    <Modal open title={impedimentCopy.assignTitle} onClose={onClose}>
      <form className={styles.dialogForm} noValidate onSubmit={submit}>
        <p className={styles.dialogText}>
          {impediment.taskKey} · {impediment.taskTitle}
        </p>
        {loading ? (
          <p role="status" className={styles.hint}>
            {impedimentCopy.ownerCandidatesLoading}
          </p>
        ) : null}
        {detail.isError ? (
          <p role="alert" className={styles.error}>
            {impedimentCopy.ownerCandidatesError}
          </p>
        ) : null}
        <label className={styles.field} htmlFor={selectId}>
          <span className={styles.label}>{impedimentCopy.assignSelect}</span>
          <select
            id={selectId}
            className={styles.select}
            value={value}
            disabled={loading}
            onChange={(event) => setValue(event.currentTarget.value)}
          >
            <option value="">{impedimentCopy.noOwner}</option>
            {options.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        {assign.isError ? (
          <p role="alert" className={styles.error}>
            {refusalMessage(assign.error, impedimentCopy.assignError)}
          </p>
        ) : null}
        <div className={styles.dialogActions}>
          <Button type="button" onClick={onClose}>
            {impedimentCopy.assignCancel}
          </Button>
          <Button type="submit" variant="primary" disabled={loading || assign.isPending}>
            {impedimentCopy.assignSave}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Resolver com nota opcional (até 280). A tarefa sai do estado bloqueado. */
export function ResolveDialog({ impediment, onClose, onDone }: ImpedimentDialogProps) {
  const resolve = useResolveImpediment()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const noteId = useId()
  const count = Array.from(note.trim()).length

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const problem = validateResolutionInput(note)
    setError(problem)
    if (problem) return
    const trimmed = note.trim()
    resolve.mutate(
      { impedimentId: impediment.id, resolution: trimmed === '' ? null : trimmed },
      {
        onSuccess: () => {
          onDone(impedimentCopy.resolveDone)
          onClose()
        },
      },
    )
  }

  return (
    <Modal open title={impedimentCopy.resolveTitle} onClose={onClose}>
      <form className={styles.dialogForm} noValidate onSubmit={submit}>
        <p className={styles.dialogText}>
          {impediment.taskKey} · {impediment.taskTitle}
        </p>
        <p className={styles.hint}>{impedimentCopy.resolveBody}</p>
        <TextArea
          id={noteId}
          label={impedimentCopy.resolutionLabel}
          rows={3}
          value={note}
          aria-invalid={error !== null}
          aria-describedby={`${noteId}-count`}
          onChange={(event) => {
            setNote(event.currentTarget.value)
            if (error) setError(validateResolutionInput(event.currentTarget.value))
          }}
        />
        <div className={styles.counter}>
          <span
            id={`${noteId}-count`}
            className={count > RESOLUTION_MAX_LENGTH ? styles.counterOver : undefined}
          >
            {count}/{RESOLUTION_MAX_LENGTH}
          </span>
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        {resolve.isError ? (
          <p role="alert" className={styles.error}>
            {refusalMessage(resolve.error, impedimentCopy.resolveError)}
          </p>
        ) : null}
        <div className={styles.dialogActions}>
          <Button type="button" onClick={onClose}>
            {impedimentCopy.assignCancel}
          </Button>
          <Button type="submit" variant="primary" disabled={resolve.isPending}>
            {impedimentCopy.resolveConfirm}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
