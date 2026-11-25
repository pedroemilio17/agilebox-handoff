import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parseQuickAdd } from '@agilebox/core'
import { useActor } from '../../shared/session/useActor'
import { todayDateOnly } from '../../shared/lib/today'
import { isArchivedTask } from '../../shared/lib/task-signals'
import { useProjects } from '../../panel/hooks/use-projects'
import { useSessionUsers } from '../../panel/hooks/use-session-users'
import { useCreateTask } from '../../panel/hooks/use-create-task'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { trayCopy } from '../copy'
import { filterTasks, normalizeSearch } from '../search'
import { BrandMark, CollapseButton, OpenPanelButton, TrayHeader } from '../TrayHeader'
import kanClosedUrl from '../../shared/assets/kan-closed.png'
import { TaskRow } from './TaskRow'
import styles from '../Tray.module.css'

export interface HomeScreenProps {
  /** Barra "Registrar o dia?" disponível: check-ins ligados, daily devida e criação permitida. */
  readonly dailyBarAvailable: boolean
  /** "Depois" já clicado nesta sessão: a barra recolhe com transição. */
  readonly dailyDismissed: boolean
  readonly onStartDaily: () => void
  readonly onDismissDaily: () => void
  readonly onOpenTask: (taskId: string) => void
  readonly onCreated: (id: string) => void
  readonly onNewTask: () => void
  readonly onOpenKan: () => void
  readonly onCollapse: () => void
}

interface Mention {
  readonly kind: '@' | '#'
  readonly token: string
  readonly label: string
  readonly hint: string
}

export function HomeScreen({
  dailyBarAvailable,
  dailyDismissed,
  onStartDaily,
  onDismissDaily,
  onOpenTask,
  onNewTask,
  onCreated,
  onOpenKan,
  onCollapse,
}: HomeScreenProps) {
  const quickInput = useRef<HTMLInputElement>(null)
  const api = useApi()
  const actor = useActor()
  const projects = useProjects()
  const people = useSessionUsers()
  const create = useCreateTask()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const parsed = parseQuickAdd(draft, {
    today: todayDateOnly(),
    projects: projects.data ?? [],
    people: people.data ?? [],
  })
  const defaultProject = projects.data?.[0]
  const projectId = parsed.projectId ?? defaultProject?.id
  const projectName = projects.data?.find((project) => project.id === projectId)?.name ?? ''
  const responsibleName = people.data?.find((person) => person.id === parsed.responsibleId)?.name
  const board = useQuery({
    queryKey: queryKeys.tasks.board(undefined, actor.actor?.userId),
    enabled: Boolean(actor.actor),
    queryFn: () =>
      api.tasks.listBoard(actor.actor?.role === 'manager' ? { forUserId: actor.actor.userId } : {}),
  })
  const searching = query.trim() !== ''
  const pool = (board.data?.tasks ?? []).filter(
    (task) => !isArchivedTask(task) && (searching || task.status !== 'done'),
  )
  const visible = filterTasks(pool, query)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'n' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      )
        return
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        )
      )
        return
      event.preventDefault()
      quickInput.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Sugestões de @pessoa / #projeto para o último termo digitado.
  const tailAt = /(?:^|\s)@([^\s@#]*)$/u.exec(draft)
  const tailHash = /(?:^|\s)#([^\s@#]*)$/u.exec(draft)
  const mentions: Mention[] = tailAt
    ? (people.data ?? [])
        .filter((person) => normalizeSearch(person.name).includes(normalizeSearch(tailAt[1]!)))
        .map((person) => ({
          kind: '@',
          token: `@${person.name}`,
          label: `@${person.name}`,
          hint: trayCopy.mentionPerson,
        }))
    : tailHash
      ? (projects.data ?? [])
          .filter((project) =>
            normalizeSearch(project.name).includes(normalizeSearch(tailHash[1]!)),
          )
          .map((project) => ({
            kind: '#',
            token: `#${project.name}`,
            label: `#${project.name.replace(/\s+/gu, '')}`,
            hint: project.name,
          }))
      : []

  const applyMention = (mention: Mention) => {
    setDraft((current) =>
      current.replace(mention.kind === '@' ? /@[^\s@#]*$/u : /#[^\s@#]*$/u, `${mention.token} `),
    )
    quickInput.current?.focus()
  }

  return (
    <>
      <TrayHeader
        left={
          <>
            <span className={styles.brandDot} aria-hidden="true">
              <BrandMark />
            </span>
            <h1 className={styles.headerTitle}>{trayCopy.title}</h1>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.kanBtn}
              aria-label={trayCopy.openKan}
              title={trayCopy.openKan}
              onClick={onOpenKan}
            >
              <img src={kanClosedUrl} alt="" className={styles.kanMini} aria-hidden="true" />
              <span>{trayCopy.kanTitle}</span>
            </button>
            <CollapseButton onClick={onCollapse} />
            <OpenPanelButton />
          </>
        }
      />

      <div className={styles.topStrip}>
        {dailyBarAvailable ? (
          <div
            className={[
              styles.dailyBar,
              dailyDismissed && !searching ? styles.dailyBarHidden : '',
              searching ? styles.dailyBarSearchHidden : '',
            ].join(' ')}
            role="region"
            aria-label={trayCopy.dailyBarAria}
          >
            <span className={styles.dailyText}>
              <span className={`${styles.dotInline} ${styles.dotWarning}`} aria-hidden="true" />{' '}
              {trayCopy.dailyBarText}
            </span>
            <div className={styles.dailyActions}>
              <button
                type="button"
                className={`${styles.dailyBtn} ${styles.dailyBtnNow}`}
                tabIndex={dailyDismissed ? -1 : 0}
                onClick={onStartDaily}
              >
                {trayCopy.dailyBarNow}
              </button>
              <button
                type="button"
                className={`${styles.dailyBtn} ${styles.dailyBtnLater}`}
                tabIndex={dailyDismissed ? -1 : 0}
                onClick={onDismissDaily}
              >
                {trayCopy.dailyBarLater}
              </button>
            </div>
          </div>
        ) : null}

        <div className={styles.searchBox}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={trayCopy.searchPlaceholder}
            aria-label={trayCopy.homeSearchAria}
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>
            {searching ? trayCopy.results : trayCopy.inFocus} ({visible.length})
          </span>
          <button type="button" className={styles.quickPill} onClick={onNewTask}>
            {trayCopy.detailed}
          </button>
        </div>
        {board.isPending ? (
          <p role="status" className={styles.mutedLine}>
            Carregando tarefas…
          </p>
        ) : board.isError ? (
          <p role="alert" className={styles.errorText}>
            {trayCopy.loadError}
          </p>
        ) : visible.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>{trayCopy.noTaskFound}</h3>
            <p>{trayCopy.noTaskHint}</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label={trayCopy.tasks}>
            {visible.map((task) => (
              <TaskRow key={task.id} task={task} onOpen={onOpenTask} />
            ))}
          </ul>
        )}
      </div>

      <form
        className={styles.quickFooter}
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault()
          if (!parsed.title || !projectId || create.isPending) return
          create.mutate(
            {
              projectId,
              title: parsed.title,
              status: 'todo',
              ...(parsed.responsibleId ? { responsibleId: parsed.responsibleId } : {}),
              ...(parsed.deadline ? { deadline: parsed.deadline } : {}),
            },
            {
              onSuccess: (task) => {
                setDraft('')
                onCreated(task.id)
              },
            },
          )
        }}
      >
        {mentions.length > 0 ? (
          <div className={styles.mentionPop} role="listbox" aria-label={trayCopy.mentionAria}>
            {mentions.map((mention) => (
              <button
                key={mention.token}
                type="button"
                role="option"
                aria-selected={false}
                className={styles.mentionOpt}
                onClick={() => applyMention(mention)}
              >
                <strong>{mention.label}</strong>
                <span>{mention.hint}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.destRow}>
          <span className={styles.destPill}>
            {projectName ? `${projectName} · A fazer` : 'A fazer'}
            {responsibleName ? ` · @${responsibleName}` : ''}
          </span>
          <span>{trayCopy.quickAddHint}</span>
        </div>
        <div className={styles.quickRow}>
          <input
            ref={quickInput}
            type="text"
            className={styles.quickInput}
            aria-label={trayCopy.quickAddAria}
            placeholder={trayCopy.quickAddPlaceholder}
            value={draft}
            disabled={create.isPending}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
          <button
            type="submit"
            className={styles.quickBtn}
            title={trayCopy.quickAddSubmit}
            aria-label={trayCopy.quickAddSubmit}
            disabled={create.isPending}
          >
            +
          </button>
        </div>
        {create.isError ? (
          <p role="alert" className={styles.errorText}>
            {trayCopy.createError}
          </p>
        ) : null}
      </form>
    </>
  )
}
