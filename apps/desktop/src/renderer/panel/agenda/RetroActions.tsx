import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { MeetingOccurrenceDto, RetroActionDto, SessionUserDto } from '@agilebox/contract'
import { Avatar, Button, DateField, DueDate, ProgressBar, TextField, Toast } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './RetroActions.module.css'
import {
  RETRO_ACTIONS_MAX,
  isRetroActionOverdue,
  validateRetroActionDue,
  validateRetroActionTitle,
} from './retro-actions-rules'
import {
  useAddRetroAction,
  useRemoveRetroAction,
  useRetroActions,
  useToggleRetroAction,
  useUpdateRetroAction,
} from './use-retro-actions'

export interface RetroActionsProps {
  /** Ocorrência da retro aberta no painel. */
  readonly meeting: MeetingOccurrenceDto
  readonly today: string
  readonly users: readonly SessionUserDto[]
  /** Só o gestor cria, edita e remove combinados. */
  readonly canManage: boolean
}

interface Notice {
  readonly id: number
  readonly message: string
}

export function RetroActions({ meeting, today, users, canManage }: RetroActionsProps) {
  const meetingId = meeting.seriesId
  const occurrenceDate = meeting.occurrenceDate
  const list = useRetroActions(meetingId, occurrenceDate)
  const add = useAddRetroAction(meetingId, occurrenceDate)
  const update = useUpdateRetroAction()
  const toggle = useToggleRetroAction(meetingId, occurrenceDate)
  const remove = useRemoveRetroAction()
  const [notice, setNotice] = useState<Notice | null>(null)
  const headingId = useId()
  const actions = list.data ?? []
  const total = actions.length
  const done = actions.filter((action) => action.done).length
  const full = total >= RETRO_ACTIONS_MAX

  const notify = (message: string) =>
    setNotice((current) => ({ id: (current?.id ?? 0) + 1, message }))

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <header className={styles.header}>
        <h3 id={headingId} className={styles.title}>
          {panelCopy.retroActionsTitle}
        </h3>
        {total > 0 ? (
          <span className={styles.progressText}>{panelCopy.retroActionsProgress(done, total)}</span>
        ) : null}
      </header>

      {list.isPending ? (
        <p role="status" className={styles.helper}>
          {panelCopy.retroActionsLoading}
        </p>
      ) : list.isError ? (
        <p role="alert" className={styles.helper}>
          {panelCopy.retroActionsError}
        </p>
      ) : (
        <>
          {total > 0 ? (
            <ProgressBar
              done={done}
              total={total}
              label={panelCopy.retroActionsProgressLabel}
              className={styles.bar}
            />
          ) : null}

          {total === 0 ? (
            <p className={styles.helper}>{panelCopy.retroActionsEmpty}</p>
          ) : (
            <ul aria-label={panelCopy.retroActionsTitle} className={styles.list}>
              {actions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  today={today}
                  users={users}
                  canManage={canManage}
                  occurrenceDate={occurrenceDate}
                  onToggle={(next) =>
                    toggle.mutate(
                      { actionId: action.id, done: next },
                      { onError: () => notify(panelCopy.retroActionsToggleError) },
                    )
                  }
                  onSave={(changes, onDone) =>
                    update.mutate(
                      { actionId: action.id, changes },
                      {
                        onSuccess: onDone,
                        onError: () => notify(panelCopy.retroActionsSaveError),
                      },
                    )
                  }
                  onRemove={() =>
                    remove.mutate(action.id, {
                      onError: () => notify(panelCopy.retroActionsRemoveError),
                    })
                  }
                />
              ))}
            </ul>
          )}

          {canManage ? null : <p className={styles.helper}>{panelCopy.retroActionsReadOnly}</p>}
          {canManage && full ? (
            <p className={styles.helper}>{panelCopy.retroActionsLimit}</p>
          ) : null}
          {canManage && !full ? (
            <AddForm
              key={occurrenceDate}
              users={users}
              occurrenceDate={occurrenceDate}
              saving={add.isPending}
              onAdd={(input, onDone) =>
                add.mutate(input, {
                  onSuccess: onDone,
                  onError: () => notify(panelCopy.retroActionsSaveError),
                })
              }
            />
          ) : null}
        </>
      )}

      {notice ? <Toast key={notice.id} message={notice.message} /> : null}
    </section>
  )
}

interface ActionRowProps {
  readonly action: RetroActionDto
  readonly today: string
  readonly users: readonly SessionUserDto[]
  readonly canManage: boolean
  readonly occurrenceDate: string
  readonly onToggle: (done: boolean) => void
  readonly onSave: (
    changes: {
      readonly title: string
      readonly responsibleId: string | null
      readonly dueDate: string | null
    },
    onDone: () => void,
  ) => void
  readonly onRemove: () => void
}

function ActionRow({
  action,
  today,
  users,
  canManage,
  occurrenceDate,
  onToggle,
  onSave,
  onRemove,
}: ActionRowProps) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const overdue = isRetroActionOverdue(action, today)

  return (
    <li className={styles.item}>
      <input
        type="checkbox"
        className={styles.check}
        checked={action.done}
        disabled={!action.canToggle}
        aria-label={panelCopy.retroActionsToggle(action.title)}
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
      {editing ? (
        <ActionEditForm
          action={action}
          users={users}
          occurrenceDate={occurrenceDate}
          onCancel={() => setEditing(false)}
          onSave={(changes) => onSave(changes, () => setEditing(false))}
        />
      ) : (
        <div className={styles.body}>
          <span className={action.done ? styles.titleDone : styles.itemTitle}>{action.title}</span>
          <span className={styles.meta}>
            {action.responsibleName ? (
              <span className={styles.person}>
                <Avatar name={action.responsibleName} className={styles.avatar} />
                {action.responsibleName}
              </span>
            ) : (
              <span>{panelCopy.retroActionsNoResponsible}</span>
            )}
            {action.dueDate ? (
              <DueDate date={action.dueDate} overdue={overdue} />
            ) : (
              <span className={styles.mono}>{panelCopy.retroActionsNoDue}</span>
            )}
          </span>
          {canManage && confirming ? (
            <div
              role="group"
              aria-label={panelCopy.retroActionsConfirmRemove}
              className={styles.confirm}
            >
              <p>{panelCopy.retroActionsConfirmRemove}</p>
              <Button type="button" onClick={onRemove}>
                {panelCopy.retroActionsConfirmRemoveButton}
              </Button>
              <Button type="button" onClick={() => setConfirming(false)}>
                {panelCopy.retroActionsKeep}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {canManage && !editing ? (
        <span className={styles.actions}>
          <Button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={panelCopy.retroActionsEdit(action.title)}
          >
            {panelCopy.retroActionsEditButton}
          </Button>
          <Button
            type="button"
            aria-label={panelCopy.retroActionsRemove(action.title)}
            onClick={() => setConfirming(true)}
          >
            {panelCopy.retroActionsRemoveButton}
          </Button>
        </span>
      ) : null}
    </li>
  )
}

interface ActionEditFormProps {
  readonly action: RetroActionDto
  readonly users: readonly SessionUserDto[]
  readonly occurrenceDate: string
  readonly onCancel: () => void
  readonly onSave: (changes: {
    readonly title: string
    readonly responsibleId: string | null
    readonly dueDate: string | null
  }) => void
}

function ActionEditForm({ action, users, occurrenceDate, onCancel, onSave }: ActionEditFormProps) {
  const ids = useId()
  const [title, setTitle] = useState(action.title)
  const [responsibleId, setResponsibleId] = useState(action.responsibleId ?? '')
  const [dueDate, setDueDate] = useState(action.dueDate ?? '')
  const titleError = validateRetroActionTitle(title)
  const dueError = validateRetroActionDue(dueDate, occurrenceDate)
  const titleErrorId = `${ids}-titulo-erro`
  const dueErrorId = `${ids}-prazo-erro`

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (titleError || dueError) return
    onSave({
      title: title.trim(),
      responsibleId: responsibleId === '' ? null : responsibleId,
      dueDate: dueDate === '' ? null : dueDate,
    })
  }

  return (
    <form
      className={styles.editForm}
      noValidate
      aria-label={panelCopy.retroActionsEditing}
      onSubmit={submit}
      onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <TextField
        id={`${ids}-titulo`}
        label={panelCopy.retroActionsTitleField}
        value={title}
        autoFocus
        aria-invalid={titleError !== null}
        aria-describedby={titleError ? titleErrorId : undefined}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      {titleError ? (
        <p id={titleErrorId} role="alert" className={styles.error}>
          {titleError}
        </p>
      ) : null}
      <ResponsibleSelect
        id={`${ids}-responsavel`}
        users={users}
        value={responsibleId}
        onChange={setResponsibleId}
      />
      <DateField
        id={`${ids}-prazo`}
        label={panelCopy.retroActionsDueOptional}
        value={dueDate}
        aria-invalid={dueError !== null}
        aria-describedby={dueError ? dueErrorId : undefined}
        onChange={(event) => setDueDate(event.currentTarget.value)}
      />
      {dueError ? (
        <p id={dueErrorId} role="alert" className={styles.error}>
          {dueError}
        </p>
      ) : null}
      <span className={styles.actions}>
        <Button type="submit" variant="primary" disabled={titleError !== null || dueError !== null}>
          {panelCopy.retroActionsSave}
        </Button>
        <Button type="button" onClick={onCancel}>
          {panelCopy.cancel}
        </Button>
      </span>
    </form>
  )
}

interface ResponsibleSelectProps {
  readonly id: string
  readonly users: readonly SessionUserDto[]
  /** Id do usuário; vazio quando não há responsável. */
  readonly value: string
  readonly onChange: (value: string) => void
}

/** Só usuários da organização entram aqui (entidades nunca são responsáveis). */
function ResponsibleSelect({ id, users, value, onChange }: ResponsibleSelectProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{panelCopy.retroActionsResponsible}</span>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">{panelCopy.retroActionsNoResponsible}</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </label>
  )
}

interface AddFormProps {
  readonly users: readonly SessionUserDto[]
  readonly occurrenceDate: string
  readonly saving: boolean
  readonly onAdd: (
    input: {
      readonly title: string
      readonly responsibleId: string | null
      readonly dueDate: string | null
    },
    onDone: () => void,
  ) => void
}

function AddForm({ users, occurrenceDate, saving, onAdd }: AddFormProps) {
  const ids = useId()
  const titleId = `${ids}-titulo`
  const [title, setTitle] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [dueError, setDueError] = useState<string | null>(null)
  const titleErrorId = `${ids}-titulo-erro`
  const dueErrorId = `${ids}-prazo-erro`

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextTitle = validateRetroActionTitle(title)
    const nextDue = validateRetroActionDue(dueDate, occurrenceDate)
    setTitleError(nextTitle)
    setDueError(nextDue)
    if (nextTitle || nextDue) return
    onAdd(
      {
        title: title.trim(),
        responsibleId: responsibleId === '' ? null : responsibleId,
        dueDate: dueDate === '' ? null : dueDate,
      },
      () => {
        setTitle('')
        setResponsibleId('')
        setDueDate('')
        // Enter adiciona e mantém o foco no campo para o próximo combinado.
        document.getElementById(titleId)?.focus()
      },
    )
  }

  return (
    <form
      className={styles.addForm}
      noValidate
      aria-label={panelCopy.retroActionsAddLabel}
      onSubmit={submit}
    >
      <TextField
        id={titleId}
        label={panelCopy.retroActionsTitleField}
        placeholder={panelCopy.retroActionsTitlePlaceholder}
        value={title}
        aria-invalid={titleError !== null}
        aria-describedby={titleError ? titleErrorId : undefined}
        onChange={(event) => {
          setTitle(event.currentTarget.value)
          if (titleError) setTitleError(validateRetroActionTitle(event.currentTarget.value))
        }}
      />
      {titleError ? (
        <p id={titleErrorId} role="alert" className={styles.error}>
          {titleError}
        </p>
      ) : null}
      <ResponsibleSelect
        id={`${ids}-responsavel`}
        users={users}
        value={responsibleId}
        onChange={setResponsibleId}
      />
      <DateField
        id={`${ids}-prazo`}
        label={panelCopy.retroActionsDueOptional}
        value={dueDate}
        aria-invalid={dueError !== null}
        aria-describedby={dueError ? dueErrorId : undefined}
        onChange={(event) => {
          setDueDate(event.currentTarget.value)
          if (dueError)
            setDueError(validateRetroActionDue(event.currentTarget.value, occurrenceDate))
        }}
      />
      {dueError ? (
        <p id={dueErrorId} role="alert" className={styles.error}>
          {dueError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={saving}>
        {panelCopy.retroActionsAdd}
      </Button>
    </form>
  )
}
