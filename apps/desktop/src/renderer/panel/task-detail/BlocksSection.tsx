import { useId, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import type { GetTaskDto, ImpedimentRefDto } from '@agilebox/contract'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { formatDate } from '../../shared/lib/format-date'
import { panelCopy } from '../copy'
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
import { taskCopy } from './task-detail-copy'
import { useBlockTask, useUnblockTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

/** Mesmo limite do contrato (`taskBlockReasonSchema`). */
const BLOCK_REASON_MAX_LENGTH = 280

export interface BlocksSectionProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  /** O cabeçalho e o aviso de parada levam o foco para este campo. */
  readonly reasonInputRef: RefObject<HTMLInputElement | null>
}

/** Validação do motivo: obrigatório e até 280 caracteres (sem contar espaços das pontas). */
export function validateBlockReasonInput(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return panelCopy.blockReasonRequired
  if (Array.from(trimmed).length > BLOCK_REASON_MAX_LENGTH) return panelCopy.blockReasonTooLong
  return null
}

/** O que a linha precisa do impedimento: o detalhe traz a referência; o histórico traz o completo. */
type ImpedimentInfo = Pick<ImpedimentRefDto, 'id' | 'ownerId' | 'ownerName' | 'openedAt'> & {
  readonly resolvedAt?: string | null
  readonly resolution?: string | null
}

interface Row {
  readonly id: string
  readonly reason: string
  readonly open: boolean
  readonly impediment: ImpedimentInfo | null
}

/** Itens da lista: o histórico (tela de impedimentos) ou só o motivo do bloqueio atual. */
function rowsOf(task: GetTaskDto, withHistory: boolean): Row[] {
  const history = withHistory ? (task.impedimentHistory ?? []) : []
  const rows: Row[] = [...history].reverse().map((item) => ({
    id: item.id,
    reason: item.reason,
    open: item.status === 'open',
    impediment: item,
  }))
  const hasOpen = rows.some((row) => row.open)
  if (task.blockedReason !== null && !hasOpen) {
    rows.unshift({
      id: task.impediment?.id ?? 'current',
      reason: task.blockedReason,
      open: true,
      impediment: task.impediment ?? null,
    })
  }
  return rows
}

/** Bloqueios (Impedimentos): lista com resolver e atribuir, e o formulário "Registrar bloqueio". */
export function BlocksSection({ task, readOnly, reasonInputRef }: BlocksSectionProps) {
  const capabilities = useCapabilities()
  const showBlocked = capabilities.can('impediments:passive')
  const showActions = capabilities.can('impediments:screen')
  const rows = showBlocked ? rowsOf(task, capabilities.showScreen('impediments')) : []
  const active = rows.filter((row) => row.open).length
  const resolved = rows.length - active
  if (!showBlocked) return null
  const canRegister =
    showActions && !capabilities.isWindingDown('impediments') && task.status !== 'done'

  return (
    <section
      className={styles.topicSection}
      aria-labelledby="task-section-blocks"
      id="task-blocks-section"
    >
      <div className={styles.topicSectionHead}>
        <h2 className={styles.topicSectionTitle} id="task-section-blocks">
          {taskCopy.blocksTitle}
        </h2>
        <span className={styles.topicSectionMeta}>
          {active ? `${active} ativo · ` : ''}
          {resolved} resolvido(s)
        </span>
      </div>
      {rows.length === 0 ? (
        <div className={styles.emptyNote}>{taskCopy.blocksNone}</div>
      ) : (
        <ul className={styles.impedimentList} aria-label={taskCopy.blocksTitle}>
          {rows.map((row) => (
            <BlockRow
              key={row.id}
              task={task}
              row={row}
              readOnly={readOnly}
              showActions={showActions}
            />
          ))}
        </ul>
      )}
      {canRegister ? (
        <RegisterBlockForm
          task={task}
          readOnly={readOnly}
          reasonInputRef={reasonInputRef}
          hasOpen={task.blockedReason !== null}
        />
      ) : null}
    </section>
  )
}

function BlockRow({
  task,
  row,
  readOnly,
  showActions,
}: {
  readonly task: GetTaskDto
  readonly row: Row
  readonly readOnly: boolean
  readonly showActions: boolean
}) {
  const unblock = useUnblockTask(task.id)
  const [mode, setMode] = useState<'assign' | 'resolve' | null>(null)
  const item = row.impediment
  const meta: string[] = []
  if (item) {
    meta.push(item.ownerName ?? impedimentCopy.noOwner)
    meta.push(impedimentCopy.historyOpened(formatDate(new Date(item.openedAt))))
    if (item.resolvedAt)
      meta.push(impedimentCopy.historyResolved(formatDate(new Date(item.resolvedAt))))
  }
  meta.push(row.open ? taskCopy.blockOpen : taskCopy.blockResolved)

  return (
    <li className={styles.impedimentRow} style={{ flexWrap: 'wrap' }}>
      <div className={styles.impedimentMain}>
        <div className={styles.impedimentReason}>
          {row.open ? (
            <span className={`${styles.dotInline} ${styles.dotDanger}`} aria-hidden="true" />
          ) : null}
          <span>{row.reason}</span>
        </div>
        <div className={styles.impedimentMeta}>{meta.join(' · ')}</div>
        {item?.resolution ? (
          <div className={styles.impedimentMeta}>
            {impedimentCopy.resolutionNote(item.resolution)}
          </div>
        ) : null}
      </div>
      {row.open && showActions ? (
        <div className={styles.impedimentActions}>
          {item ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
              aria-expanded={mode === 'assign'}
              disabled={readOnly}
              onClick={() => setMode(mode === 'assign' ? null : 'assign')}
            >
              {taskCopy.blockAssign}
            </button>
          ) : null}
          <button
            type="button"
            data-resolve-block={row.id}
            className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
            aria-expanded={mode === 'resolve'}
            disabled={readOnly || unblock.isPending}
            onClick={() => setMode(mode === 'resolve' ? null : 'resolve')}
          >
            {taskCopy.blockResolve}
          </button>
        </div>
      ) : (
        <span className={styles.topicSectionMeta}>{row.open ? '' : taskCopy.blockResolved}</span>
      )}
      {mode === 'assign' && item ? (
        <div style={{ flexBasis: '100%' }}>
          <AssignInline key={item.id} impediment={item} task={task} onDone={() => setMode(null)} />
        </div>
      ) : null}
      {mode === 'resolve' ? (
        <div style={{ flexBasis: '100%' }}>
          <ResolveInline
            disabled={unblock.isPending}
            onSubmit={(resolution) =>
              unblock.mutate(resolution, { onSuccess: () => setMode(null) })
            }
            onCancel={() => setMode(null)}
            error={unblock.error}
          />
        </div>
      ) : null}
      {mode === null ? <SaveError error={unblock.error} /> : null}
    </li>
  )
}

/** Atribuir responsável: participantes da tarefa e gestor. "Sem responsável" limpa. */
function AssignInline({
  impediment,
  task,
  onDone,
}: {
  readonly impediment: ImpedimentInfo
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
      className={styles.impedimentForm}
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        assign.mutate(
          { impedimentId: impediment.id, ownerId: ownerIdFromSelect(value) },
          { onSuccess: onDone },
        )
      }}
    >
      <label className={styles.fieldLabel} htmlFor={selectId}>
        {impedimentCopy.assignSelect}
      </label>
      <select
        id={selectId}
        className={`${styles.kvSelect} ${styles.formSelect}`}
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
      <div className={styles.buttonRow}>
        <button
          type="submit"
          className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
          disabled={assign.isPending}
        >
          {impedimentCopy.assignSave}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          onClick={onDone}
        >
          {impedimentCopy.assignCancel}
        </button>
      </div>
      {assign.isError ? (
        <p role="alert" className={styles.errorNote}>
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
      className={styles.impedimentForm}
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
      <label className={styles.fieldLabel} htmlFor={noteId}>
        {impedimentCopy.resolutionLabel}
      </label>
      <textarea
        id={noteId}
        className={styles.cleanTextarea}
        rows={2}
        value={note}
        aria-invalid={problem !== null}
        aria-describedby={`${noteId}-count`}
        onChange={(event) => {
          setNote(event.currentTarget.value)
          if (problem) setProblem(validateResolutionInput(event.currentTarget.value))
        }}
      />
      <div className={styles.formFooter}>
        <span
          id={`${noteId}-count`}
          className={count > RESOLUTION_MAX_LENGTH ? styles.errorNote : styles.topicSectionMeta}
        >
          {count}/{RESOLUTION_MAX_LENGTH}
        </span>
        {problem ? (
          <p role="alert" className={styles.errorNote}>
            {problem}
          </p>
        ) : null}
      </div>
      <div className={styles.buttonRow}>
        <button
          type="submit"
          className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
          disabled={disabled}
        >
          {impedimentCopy.resolveConfirm}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          onClick={onCancel}
        >
          {impedimentCopy.assignCancel}
        </button>
      </div>
      {error ? <SaveError error={error} /> : null}
    </form>
  )
}

/** Motivo + "Registrar bloqueio". Com um bloqueio aberto o campo fica travado (um por vez). */
function RegisterBlockForm({
  task,
  readOnly,
  reasonInputRef,
  hasOpen,
}: {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  readonly reasonInputRef: RefObject<HTMLInputElement | null>
  readonly hasOpen: boolean
}) {
  const block = useBlockTask(task.id)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  const locked = readOnly || hasOpen

  return (
    <form
      noValidate
      className={styles.addColumn}
      aria-label={taskCopy.blockSubmit}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const message = validateBlockReasonInput(reason)
        setError(message)
        if (message) return
        block.mutate(
          { reason: reason.trim() },
          {
            onSuccess: () => {
              setReason('')
              setError(null)
            },
          },
        )
      }}
    >
      <div className={styles.inlineAddRow}>
        <input
          ref={reasonInputRef}
          type="text"
          className={styles.input}
          placeholder={taskCopy.blockReasonPlaceholder}
          aria-label={taskCopy.blockReasonAria}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          disabled={locked}
          value={reason}
          onChange={(event) => {
            setReason(event.currentTarget.value)
            if (error) setError(validateBlockReasonInput(event.currentTarget.value))
          }}
        />
        <button
          type="submit"
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={locked || block.isPending}
        >
          {taskCopy.blockSubmit}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className={styles.errorNote}>
          {error}
        </p>
      ) : null}
      <SaveError error={block.error} />
    </form>
  )
}
