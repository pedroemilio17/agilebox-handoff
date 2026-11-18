import { useId, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@agilebox/ui'
import type { WbsRowDto } from '@agilebox/contract'
import { NewDeliverableForm, wbsCopy } from './WbsForms'
import {
  canHaveSubdeliverable,
  expandableIds,
  formatCost,
  dayMonthText,
  formatHours,
  initialsOf,
  overdueDays,
  overdueText,
  progressTone,
  siblingMove,
  taskStatusText,
  type MoveDirection,
  type WbsDeliverableRow,
  type WbsTaskRow,
} from './wbs-screen'
import styles from './WbsView.module.css'

type Editing =
  | { readonly kind: 'rename'; readonly id: string }
  | { readonly kind: 'child'; readonly parentId: string }
  | { readonly kind: 'remove'; readonly id: string }

export interface WbsTableProps {
  /** Linhas visíveis (sem as escondidas por entregas recolhidas), na ordem de exibição. */
  readonly rows: readonly WbsRowDto[]
  /** Todas as linhas: os irmãos e os filhos não mudam com o recolher. */
  readonly allRows: readonly WbsRowDto[]
  readonly collapsed: ReadonlySet<string>
  readonly canEdit: boolean
  /** Módulo `cost` ligado no projeto. Desligado, a coluna de custo não aparece. */
  readonly costEnabled: boolean
  /** Hoje (AAAA-MM-DD): tarefa com prazo antes dele, sem concluir, ganha o aviso de atraso. */
  readonly today: string
  readonly onToggle: (id: string) => void
  readonly onRename: (id: string, title: string) => Promise<boolean>
  readonly onCreateChild: (parentId: string, title: string) => Promise<boolean>
  readonly onMove: (id: string, parentId: string | null, position: number) => void
  readonly onRemove: (id: string) => Promise<boolean>
}

/**
 * Árvore da EAP como tabela semântica: cada entrega é uma linha, o botão de recolher tem nome e
 * `aria-expanded`, e as ações por entrega aparecem só para quem pode editar.
 */
export function WbsTable(props: WbsTableProps) {
  const { rows, allRows, collapsed, canEdit, costEnabled, today } = props
  const [editing, setEditing] = useState<Editing | null>(null)
  const idPrefix = useId()
  const expandable = new Set(expandableIds(allRows))
  const columns = (canEdit ? 7 : 6) - (costEnabled ? 0 : 1)

  function triggerId(kind: string, id: string) {
    return `${idPrefix}-${kind}-${id}`
  }

  function focusTrigger(kind: string, id: string) {
    requestAnimationFrame(() => document.getElementById(triggerId(kind, id))?.focus())
  }

  function close(kind: string, id: string) {
    setEditing(null)
    focusTrigger(kind, id)
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Estrutura de entregas e tarefas do projeto</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.colCode}>
              Código
            </th>
            <th scope="col">Entrega ou tarefa</th>
            <th scope="col" className={styles.colResp}>
              Resp.
            </th>
            <th scope="col" className={styles.colNum}>
              Horas
            </th>
            {costEnabled ? (
              <th scope="col" className={styles.colCost}>
                Custo
              </th>
            ) : null}
            <th scope="col" className={styles.colProgress}>
              Progresso
            </th>
            {canEdit ? (
              <th scope="col" className={styles.colActions}>
                <span className={styles.srOnly}>Ações</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.kind === 'task') {
              return (
                <TaskRow
                  key={`t-${row.taskId}`}
                  row={row}
                  canEdit={canEdit}
                  costEnabled={costEnabled}
                  today={today}
                />
              )
            }
            const isCollapsed = collapsed.has(row.id)
            const moveUp = canEdit ? siblingMove(allRows, row.id, 'up') : null
            const moveDown = canEdit ? siblingMove(allRows, row.id, 'down') : null
            return (
              <DeliverableRows
                key={`d-${row.id}`}
                row={row}
                columns={columns}
                canEdit={canEdit}
                costEnabled={costEnabled}
                hasChildren={expandable.has(row.id)}
                isCollapsed={isCollapsed}
                onToggle={() => props.onToggle(row.id)}
                renameEditing={editing?.kind === 'rename' && editing.id === row.id}
                removeEditing={editing?.kind === 'remove' && editing.id === row.id}
                childEditing={editing?.kind === 'child' && editing.parentId === row.id}
                canMoveUp={moveUp !== null}
                canMoveDown={moveDown !== null}
                triggerId={(kind) => triggerId(kind, row.id)}
                onStartRename={() => setEditing({ kind: 'rename', id: row.id })}
                onStartChild={() => setEditing({ kind: 'child', parentId: row.id })}
                onStartRemove={() => setEditing({ kind: 'remove', id: row.id })}
                onCancel={(kind) => close(kind, row.id)}
                onRename={async (title) => {
                  if (title === row.title) {
                    close('rename', row.id)
                    return true
                  }
                  const saved = await props.onRename(row.id, title)
                  if (saved) close('rename', row.id)
                  return saved
                }}
                onCreateChild={async (title) => {
                  const created = await props.onCreateChild(row.id, title)
                  if (created) setEditing(null)
                  return created
                }}
                onMove={(direction: MoveDirection) => {
                  const target = direction === 'up' ? moveUp : moveDown
                  if (target) props.onMove(row.id, target.parentId, target.position)
                }}
                onRemove={async () => {
                  const removed = await props.onRemove(row.id)
                  if (removed) setEditing(null)
                  return removed
                }}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface DeliverableRowsProps {
  readonly row: WbsDeliverableRow
  readonly columns: number
  readonly canEdit: boolean
  readonly costEnabled: boolean
  readonly hasChildren: boolean
  readonly isCollapsed: boolean
  readonly renameEditing: boolean
  readonly removeEditing: boolean
  readonly childEditing: boolean
  readonly canMoveUp: boolean
  readonly canMoveDown: boolean
  readonly triggerId: (kind: string) => string
  readonly onToggle: () => void
  readonly onStartRename: () => void
  readonly onStartChild: () => void
  readonly onStartRemove: () => void
  readonly onCancel: (kind: string) => void
  readonly onRename: (title: string) => Promise<boolean>
  readonly onCreateChild: (title: string) => Promise<boolean>
  readonly onMove: (direction: MoveDirection) => void
  readonly onRemove: () => Promise<boolean>
}

function DeliverableRows(props: DeliverableRowsProps) {
  const { row, canEdit } = props
  const milestones = row.totals.milestones
  const style = { '--level': row.level } as CSSProperties
  return (
    <>
      <tr className={styles.deliverableRow} data-level={row.level}>
        <td className={styles.code}>{row.code}</td>
        <th scope="row" className={styles.titleCell}>
          <div className={styles.titleInner} style={style}>
            {props.hasChildren ? (
              <button
                type="button"
                className={styles.expander}
                aria-expanded={!props.isCollapsed}
                aria-label={`${props.isCollapsed ? 'Expandir' : 'Recolher'} ${row.title}`}
                onClick={props.onToggle}
              >
                <svg
                  className={styles.chevron}
                  data-collapsed={props.isCollapsed}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            ) : (
              <span className={styles.expanderSpacer} aria-hidden="true" />
            )}
            {props.renameEditing ? (
              <RenameForm
                title={row.title}
                onSave={props.onRename}
                onCancel={() => props.onCancel('rename')}
              />
            ) : (
              <span className={styles.deliverableTitle}>{row.title}</span>
            )}
            {milestones.map((milestone) => (
              <span key={milestone.id} className={styles.milestone}>
                <span className={styles.diamond} aria-hidden="true" />
                {`${milestone.title} · ${dayMonthText(milestone.dueOn)}`}
              </span>
            ))}
          </div>
        </th>
        <td className={styles.resp} />
        <td className={styles.num}>{formatHours(row.totals.hours)}</td>
        {props.costEnabled ? <td className={styles.num}>{formatCost(row.totals.cost)}</td> : null}
        <td>
          <ProgressCell progress={row.totals.progress} />
        </td>
        {canEdit ? (
          <td className={styles.actions}>
            <div className={styles.actionOverlay}>
              <div className={styles.actionList}>
                {canHaveSubdeliverable(row.level) ? (
                  <button
                    type="button"
                    id={props.triggerId('child')}
                    className={styles.action}
                    aria-label={`${wbsCopy.subdeliverable} em ${row.title}`}
                    onClick={props.onStartChild}
                  >
                    {wbsCopy.subdeliverable}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.action}
                  aria-label={`${wbsCopy.moveUp} ${row.title}`}
                  disabled={!props.canMoveUp}
                  onClick={() => props.onMove('up')}
                >
                  {wbsCopy.moveUp}
                </button>
                <button
                  type="button"
                  className={styles.action}
                  aria-label={`${wbsCopy.moveDown} ${row.title}`}
                  disabled={!props.canMoveDown}
                  onClick={() => props.onMove('down')}
                >
                  {wbsCopy.moveDown}
                </button>
                <button
                  type="button"
                  id={props.triggerId('rename')}
                  className={styles.action}
                  aria-label={`${wbsCopy.rename} ${row.title}`}
                  onClick={props.onStartRename}
                >
                  {wbsCopy.rename}
                </button>
                <button
                  type="button"
                  id={props.triggerId('remove')}
                  className={`${styles.action} ${styles.danger}`}
                  aria-label={`${wbsCopy.remove} ${row.title}`}
                  onClick={props.onStartRemove}
                >
                  {wbsCopy.remove}
                </button>
              </div>
              {props.removeEditing ? (
                <RemoveConfirm
                  title={row.title}
                  onConfirm={props.onRemove}
                  onCancel={() => props.onCancel('remove')}
                />
              ) : null}
            </div>
          </td>
        ) : null}
      </tr>
      {props.childEditing ? (
        <tr className={styles.childRow}>
          <td colSpan={props.columns}>
            <div
              style={{ '--level': row.level + 1 } as CSSProperties}
              className={styles.childIndent}
            >
              <NewDeliverableForm
                label={`Nome da subentrega de ${row.title}`}
                onSubmit={props.onCreateChild}
                onCancel={() => props.onCancel('child')}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function ProgressCell({ progress }: { readonly progress: number }) {
  return (
    <div className={styles.progress}>
      <span className={styles.track} aria-hidden="true">
        <span
          className={styles.fill}
          data-tone={progressTone(progress)}
          style={{ width: `${progress}%` }}
        />
      </span>
      <span className={styles.percent}>{progress}%</span>
    </div>
  )
}

function TaskRow({
  row,
  canEdit,
  costEnabled,
  today,
}: {
  readonly row: WbsTaskRow
  readonly canEdit: boolean
  readonly costEnabled: boolean
  readonly today: string
}) {
  const style = { '--level': 2 } as CSSProperties
  const late = overdueDays(row.deadline, row.done, today)
  return (
    <tr className={styles.taskRow}>
      <td className={styles.code}>{row.key}</td>
      <th scope="row" className={styles.titleCell}>
        <div className={styles.titleInner} style={style}>
          <span className={styles.statusDot} data-status={row.status} aria-hidden="true" />
          <span className={styles.taskTitle}>{row.title}</span>
          {late === null ? null : <span className={styles.warn}>{overdueText(late)}</span>}
        </div>
      </th>
      <td className={styles.resp}>
        {row.responsibleName ? (
          <span className={styles.avatar} title={row.responsibleName}>
            <span aria-hidden="true">{initialsOf(row.responsibleName)}</span>
            <span className={styles.srOnly}>{row.responsibleName}</span>
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={styles.num}>{formatHours(row.estimatedHours)}</td>
      {costEnabled ? <td className={styles.num}>{formatCost(null)}</td> : null}
      <td>
        <span className={styles.statusText} data-status={row.status}>
          {taskStatusText(row.status)}
        </span>
      </td>
      {canEdit ? <td className={styles.actions} /> : null}
    </tr>
  )
}

function RenameForm({
  title,
  onSave,
  onCancel,
}: {
  readonly title: string
  readonly onSave: (title: string) => Promise<boolean>
  readonly onCancel: () => void
}) {
  const [value, setValue] = useState(title)
  const [busy, setBusy] = useState(false)
  const trimmed = value.trim()

  async function save(event?: FormEvent) {
    event?.preventDefault()
    if (trimmed === '' || busy) return
    setBusy(true)
    await onSave(trimmed)
    setBusy(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <form className={styles.inlineForm} onSubmit={(event) => void save(event)}>
      <input
        className={styles.inlineInput}
        type="text"
        aria-label={`Novo nome de ${title}`}
        value={value}
        autoFocus
        maxLength={200}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button type="submit" variant="primary" disabled={trimmed === '' || busy}>
        {wbsCopy.save}
      </Button>
      <Button type="button" onClick={onCancel}>
        {wbsCopy.cancel}
      </Button>
    </form>
  )
}

function RemoveConfirm({
  title,
  onConfirm,
  onCancel,
}: {
  readonly title: string
  readonly onConfirm: () => Promise<boolean>
  readonly onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  async function confirm() {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }
  return (
    <div className={styles.confirm} role="group" aria-label={`Confirmar remoção de ${title}`}>
      <span className={styles.confirmText}>Remover “{title}”?</span>
      <Button type="button" disabled={busy} onClick={() => void confirm()}>
        {wbsCopy.confirmRemove}
      </Button>
      <Button type="button" onClick={onCancel}>
        {wbsCopy.cancel}
      </Button>
    </div>
  )
}
