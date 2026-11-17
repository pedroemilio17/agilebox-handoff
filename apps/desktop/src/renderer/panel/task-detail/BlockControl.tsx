import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { GetTaskDto, ImpedimentRefDto } from '@agilebox/contract'
import { Button, SignalBadge, TextArea } from '@agilebox/ui'
import { formatRelativeDate } from '../../shared/lib/format-date'
import { panelCopy } from '../copy'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { refusalMessage } from '../backlog/refusal-message'
import { useSessionUsers } from '../hooks/use-session-users'
import { impedimentCopy } from '../impediments/impediment-copy'
import {
  ownerCandidates,
  ownerIdFromSelect,
  ownerValue,
  RESOLUTION_MAX_LENGTH,
  validateResolutionInput,
} from '../impediments/impediment-rules'
import { useAssignImpediment } from '../impediments/use-impediments'
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

/**
 * Bloqueio na tarefa. Três situações: sem a tela (Básico, ou módulo com efeito passivo) só o motivo;
 * com a tela, o impedimento aberto (estado, responsável, tempo, atribuir e resolver); sem bloqueio,
 * o formulário de bloquear. Encerrando, o módulo não abre bloqueio novo.
 */
export function BlockControl({ task, readOnly }: BlockControlProps) {
  const capabilities = useCapabilities()
  // Módulo desligado: nenhum efeito, nem o motivo. Só com a tela ligada há as ações.
  const showBlocked = capabilities.can('impediments:passive')
  const showActions = capabilities.can('impediments:screen')

  if (task.blockedReason !== null) {
    if (!showBlocked) return null
    if (!showActions) return <PassiveBlock reason={task.blockedReason} />
    return <OpenImpediment task={task} readOnly={readOnly} />
  }

  // Concluída não bloqueia: o servidor também limpa o bloqueio ao concluir.
  if (!showActions || task.status === 'done' || capabilities.isWindingDown('impediments'))
    return null

  return <OpenBlockForm task={task} readOnly={readOnly} />
}

/** Sem a tela de impedimentos: o motivo aparece como informação, sem controles. */
function PassiveBlock({ reason }: { readonly reason: string }) {
  return (
    <section aria-label={panelCopy.blockedSection} className={styles.blockStrip}>
      <p>
        <SignalBadge variant="blocked">Bloqueada</SignalBadge>
        <span>{reason}</span>
      </p>
    </section>
  )
}

/** Impedimento aberto, com a tela: estado, motivo, responsável e tempo; ações de atribuir e resolver. */
function OpenImpediment({ task, readOnly }: BlockControlProps) {
  const unblock = useUnblockTask(task.id)
  const [mode, setMode] = useState<'assign' | 'resolve' | null>(null)
  const impediment: ImpedimentRefDto | null = task.impediment ?? null
  const openedAgo = impediment
    ? formatRelativeDate(new Date(impediment.openedAt), new Date())
    : null

  return (
    <section aria-label={panelCopy.blockedSection} className={styles.blockStrip}>
      <p>
        <SignalBadge variant="blocked">{impedimentCopy.detailOpen}</SignalBadge>
        <span>{task.blockedReason}</span>
      </p>
      {impediment ? (
        <p className={styles.blockMeta}>
          <span>
            {impediment.ownerName
              ? impedimentCopy.detailAssigned(impediment.ownerName)
              : impedimentCopy.noOwner}
          </span>
          {openedAgo ? <span>{impedimentCopy.detailOpenedAgo(openedAgo)}</span> : null}
        </p>
      ) : null}
      <div className={styles.blockButtons}>
        {impediment ? (
          <Button
            type="button"
            aria-expanded={mode === 'assign'}
            disabled={readOnly}
            onClick={() => setMode(mode === 'assign' ? null : 'assign')}
          >
            {impedimentCopy.assign}
          </Button>
        ) : null}
        <Button
          type="button"
          aria-expanded={mode === 'resolve'}
          disabled={readOnly || unblock.isPending}
          onClick={() => setMode(mode === 'resolve' ? null : 'resolve')}
        >
          {impedimentCopy.resolveImpediment}
        </Button>
      </div>
      {mode === 'assign' && impediment ? (
        <AssignInline
          key={impediment.id}
          impediment={impediment}
          task={task}
          onDone={() => setMode(null)}
        />
      ) : null}
      {mode === 'resolve' ? (
        <ResolveInline
          disabled={unblock.isPending}
          onSubmit={(resolution) => unblock.mutate(resolution, { onSuccess: () => setMode(null) })}
          onCancel={() => setMode(null)}
          error={unblock.error}
        />
      ) : null}
      {mode === null ? <SaveError error={unblock.error} /> : null}
    </section>
  )
}

/** Atribuir responsável: participantes da tarefa e gestor. "Sem responsável" limpa. */
function AssignInline({
  impediment,
  task,
  onDone,
}: {
  readonly impediment: ImpedimentRefDto
  readonly task: GetTaskDto
  readonly onDone: () => void
}) {
  const users = useSessionUsers()
  const assign = useAssignImpediment()
  const [value, setValue] = useState(ownerValue(impediment.ownerId))
  const selectId = useId()
  const candidates = ownerCandidates(task, users.data ?? [])
  const options =
    impediment.ownerId !== null &&
    impediment.ownerName !== null &&
    !candidates.some((candidate) => candidate.id === impediment.ownerId)
      ? [...candidates, { id: impediment.ownerId, name: impediment.ownerName }]
      : candidates

  return (
    <form
      className={styles.blockForm}
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        assign.mutate(
          { impedimentId: impediment.id, ownerId: ownerIdFromSelect(value) },
          { onSuccess: onDone },
        )
      }}
    >
      <label className={styles.blockField} htmlFor={selectId}>
        <span>{impedimentCopy.assignSelect}</span>
        <select
          id={selectId}
          className={styles.blockSelect}
          value={value}
          disabled={users.isPending || assign.isPending}
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
      <div className={styles.blockButtons}>
        <Button type="submit" variant="primary" disabled={assign.isPending}>
          {impedimentCopy.assignSave}
        </Button>
        <Button type="button" onClick={onDone}>
          {impedimentCopy.assignCancel}
        </Button>
      </div>
      {assign.isError ? (
        <p role="alert" className={styles.blockError}>
          {refusalMessage(assign.error, impedimentCopy.assignError)}
        </p>
      ) : null}
    </form>
  )
}

/** Resolver com nota opcional (até 280). Vira o desbloqueio da tarefa. */
function ResolveInline({
  disabled,
  onSubmit,
  onCancel,
  error,
}: {
  readonly disabled: boolean
  readonly onSubmit: (resolution: string | null) => void
  readonly onCancel: () => void
  readonly error: unknown
}) {
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const noteId = useId()
  const count = Array.from(note.trim()).length
  return (
    <form
      className={styles.blockForm}
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const message = validateResolutionInput(note)
        setProblem(message)
        if (message) return
        const trimmed = note.trim()
        onSubmit(trimmed === '' ? null : trimmed)
      }}
    >
      <TextArea
        id={noteId}
        label={impedimentCopy.resolutionLabel}
        rows={2}
        value={note}
        aria-invalid={problem !== null}
        aria-describedby={`${noteId}-count`}
        onChange={(event) => {
          setNote(event.currentTarget.value)
          if (problem) setProblem(validateResolutionInput(event.currentTarget.value))
        }}
      />
      <div className={styles.blockFooter}>
        <span
          id={`${noteId}-count`}
          className={count > RESOLUTION_MAX_LENGTH ? styles.blockCountOver : styles.blockCount}
        >
          {count}/{RESOLUTION_MAX_LENGTH}
        </span>
        {problem ? (
          <p role="alert" className={styles.blockError}>
            {problem}
          </p>
        ) : null}
      </div>
      <div className={styles.blockButtons}>
        <Button type="submit" variant="primary" disabled={disabled}>
          {impedimentCopy.resolveConfirm}
        </Button>
        <Button type="button" onClick={onCancel}>
          {impedimentCopy.assignCancel}
        </Button>
      </div>
      {error ? <SaveError error={error} /> : null}
    </form>
  )
}

/** Formulário de bloquear: motivo obrigatório e "Quem resolve" opcional. */
function OpenBlockForm({ task, readOnly }: BlockControlProps) {
  const taskId = task.id
  const block = useBlockTask(taskId)
  const users = useSessionUsers()
  const [formOpen, setFormOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const countId = `${fieldId}-count`
  const ownerFieldId = `${fieldId}-owner`
  const ownerHelpId = `${fieldId}-owner-help`
  const candidates = ownerCandidates(task, users.data ?? [])

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
    const chosen = ownerIdFromSelect(ownerId)
    block.mutate(
      { reason: reason.trim(), ...(chosen ? { ownerId: chosen } : {}) },
      {
        onSuccess: () => {
          setReason('')
          setOwnerId('')
          setFormOpen(false)
        },
      },
    )
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
      <div className={styles.blockField}>
        <label htmlFor={ownerFieldId}>
          <span>{impedimentCopy.whoResolves}</span>
        </label>
        <select
          id={ownerFieldId}
          className={styles.blockSelect}
          value={ownerId}
          aria-describedby={ownerHelpId}
          disabled={users.isPending || block.isPending}
          onChange={(event) => setOwnerId(event.currentTarget.value)}
        >
          <option value="">{impedimentCopy.noOwner}</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
        <p id={ownerHelpId} className={styles.blockCount}>
          {impedimentCopy.whoResolvesHelp}
        </p>
      </div>
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
            setOwnerId('')
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
