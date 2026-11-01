import { useQuery } from '@tanstack/react-query'
import { StatusChip } from '@agilebox/ui'
import { useApi } from '../shared/api/ApiProvider'
import { queryKeys } from '../shared/query/keys'
import { panelCopy } from './copy'
import styles from './App.module.css'

export function App() {
  const api = useApi()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(),
    queryFn: () => api.tasks.listBoard({}),
  })

  return (
    <main className={styles.panel} aria-label={panelCopy.title}>
      <header className={styles.header}>
        <p>{panelCopy.title}</p>
        <h1>{panelCopy.heading}</h1>
      </header>
      {tasks.isPending ? <p role="status">{panelCopy.loading}</p> : null}
      {tasks.isError ? <p role="alert">{panelCopy.error}</p> : null}
      {tasks.isSuccess && tasks.data.length === 0 ? <p>{panelCopy.empty}</p> : null}
      {tasks.isSuccess && tasks.data.length > 0 ? (
        <ul className={styles.taskList} aria-label={panelCopy.heading}>
          {tasks.data.map((task) => (
            <li className={styles.task} key={task.id}>
              <div className={styles.taskHeading}>
                <h2>{task.title}</h2>
                <StatusChip status={task.status} />
              </div>
              <p>
                <span>{panelCopy.projectLabel}: </span>
                {task.projectName}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}
