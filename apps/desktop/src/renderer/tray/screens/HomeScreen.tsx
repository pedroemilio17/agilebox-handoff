import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, SegmentedControl, Eyebrow, Kbd, Skeleton } from '@agilebox/ui'
import { parseQuickAdd } from '@agilebox/core'
import { useActor } from '../../shared/session/useActor'
import { todayDateOnly } from '../../shared/lib/today'
import { isAgingTask } from '../../shared/lib/task-signals'
import { useProjects } from '../../panel/hooks/use-projects'
import { useSessionUsers } from '../../panel/hooks/use-session-users'
import { useCreateTask } from '../../panel/hooks/use-create-task'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { trayCopy } from '../copy'
import { filterTasks } from '../search'
import { TaskRow } from './TaskRow'
import styles from '../Tray.module.css'

type Scope = 'recent' | 'frequent'

export interface HomeScreenProps {
  readonly highlightTaskId: string | null
  readonly onOpenTask: (taskId: string) => void
  readonly onCreated: (id: string) => void
  readonly onNewTask: () => void
  readonly onVisibleCount: (count: number) => void
  readonly now?: Date
}

export function HomeScreen({
  highlightTaskId,
  onOpenTask,
  onNewTask,
  onCreated,
  onVisibleCount,
  now = new Date(),
}: HomeScreenProps) {
  const quickInput = useRef<HTMLInputElement>(null)
  const api = useApi()
  const actor = useActor()
  const projects = useProjects()
  const people = useSessionUsers()
  const create = useCreateTask()
  const [draft, setDraft] = useState('')
  const parsed = parseQuickAdd(draft, {
    today: todayDateOnly(),
    projects: projects.data ?? [],
    people: people.data ?? [],
  })
  const projectId = parsed.projectId ?? projects.data?.[0]?.id
  const board = useQuery({
    queryKey: queryKeys.tasks.board(undefined, actor.actor?.userId),
    enabled: Boolean(actor.actor),
    queryFn: () =>
      api.tasks.listBoard(actor.actor?.role === 'manager' ? { forUserId: actor.actor.userId } : {}),
  })
  const name = people.data?.find((person) => person.id === actor.actor?.userId)?.name.split(' ')[0]
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const [scope, setScope] = useState<Scope>('recent')
  const [query, setQuery] = useState('')
  const tasks = useQuery({
    queryKey: [...queryKeys.tasks.all, 'tray', scope],
    queryFn: () => (scope === 'recent' ? api.tasks.listRecent() : api.tasks.listFrequent()),
  })
  const enriched = (tasks.data ?? []).map(
    (task) => board.data?.find((current) => current.id === task.id) ?? task,
  )
  const visible = filterTasks(enriched, query)
  const personal = board.data
  const activeCount = personal?.filter(
    (task) => task.status === 'in_progress' || task.status === 'review',
  ).length
  const agingCount = personal?.filter(isAgingTask).length
  const searching = query.trim() !== ''

  useEffect(() => {
    onVisibleCount(visible.length)
  }, [onVisibleCount, visible.length])

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
  return (
    <div className={styles.home}>
      <div className={styles.screenBody}>
        <header className={styles.greeting}>
          <h2>
            {greeting}
            {name ? `, ${name}.` : '.'}
          </h2>
          <p>
            {new Intl.DateTimeFormat('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'short',
            }).format(now)}{' '}
            · <span className={styles.count}>{activeCount ?? '—'}</span> em andamento ·{' '}
            <span className={styles.count}>{agingCount ?? '—'}</span>{' '}
            {agingCount === 1 ? 'parada' : 'paradas'}
          </p>
        </header>
        <input
          className={styles.search}
          aria-label={trayCopy.search}
          placeholder={trayCopy.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          autoComplete="off"
        />
        <SegmentedControl<Scope>
          aria-label={trayCopy.scope}
          value={scope}
          onChange={setScope}
          options={[
            { value: 'recent', label: trayCopy.recent },
            { value: 'frequent', label: trayCopy.frequent },
          ]}
        />
        <div className={styles.focusHeading}>
          <Eyebrow>Em foco</Eyebrow>
          <button type="button" onClick={() => window.agilebox.shell.openPanel()}>
            Ver quadro ({personal?.length ?? '—'})
          </button>
        </div>
        {tasks.isPending ? (
          <Skeleton aria-label="Carregando tarefas" />
        ) : tasks.isError ? (
          <p role="alert">{trayCopy.loadError}</p>
        ) : visible.length === 0 && !tasks.isPending ? (
          <p className={styles.empty}>{searching ? trayCopy.noResults : trayCopy.noneOpened}</p>
        ) : (
          <ul className={styles.list} aria-label={trayCopy.tasks}>
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                highlighted={task.id === highlightTaskId}
                onOpen={onOpenTask}
              />
            ))}
          </ul>
        )}
      </div>
      <form
        className={styles.quickFooter}
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
        <div className={styles.quickInput}>
          <input
            ref={quickInput}
            aria-label="Criação rápida"
            placeholder="Nova tarefa — use @pessoa e #projeto"
            value={draft}
            disabled={create.isPending}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
          <Kbd>N</Kbd>
          <Button aria-label={trayCopy.newTask} type="button" onClick={onNewTask}>
            +
          </Button>
        </div>
        {draft && (
          <div className={styles.quickTokens}>
            {parsed.tokens.map((token) => (
              <span key={token.start}>{token.label}</span>
            ))}
            <span>A fazer</span>
          </div>
        )}
        {create.isError && <p role="alert">{trayCopy.createError}</p>}
      </form>
    </div>
  )
}
