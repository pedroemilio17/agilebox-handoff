import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, SegmentedControl, TextField } from '@agilebox/ui'
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
  readonly onNewTask: () => void
  readonly onVisibleCount: (count: number) => void
  readonly now?: Date
}

export function HomeScreen({
  highlightTaskId,
  onOpenTask,
  onNewTask,
  onVisibleCount,
  now = new Date(),
}: HomeScreenProps) {
  const api = useApi()
  const [scope, setScope] = useState<Scope>('recent')
  const [query, setQuery] = useState('')
  const tasks = useQuery({
    queryKey: [...queryKeys.tasks.all, 'tray', scope],
    queryFn: () => (scope === 'recent' ? api.tasks.listRecent() : api.tasks.listFrequent()),
  })
  const visible = filterTasks(tasks.data ?? [], query)
  const searching = query.trim() !== ''

  useEffect(() => {
    onVisibleCount(visible.length)
  }, [onVisibleCount, visible.length])

  return (
    <div className={styles.screenBody}>
      <TextField
        label={trayCopy.search}
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
      {tasks.isError ? (
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
      <div className={styles.footer}>
        <Button type="button" variant="primary" onClick={onNewTask}>
          {trayCopy.newTask}
        </Button>
      </div>
    </div>
  )
}
