import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StatusChip } from '@agilebox/ui'
import { useApi } from '../shared/api/ApiProvider'
import { useActor } from '../shared/session/useActor'
import { queryKeys } from '../shared/query/keys'
import { panelCopy } from './copy'
import { PanelShell, type PanelView } from './layout/PanelShell'
import styles from './App.module.css'

export function App() {
  const api = useApi()
  const [view, setView] = useState<PanelView>('projects')
  const actor = useActor()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(),
    queryFn: () => api.tasks.listBoard({}),
  })

  return (
    <PanelShell
      view={view}
      onViewChange={setView}
      isManager={actor.capabilities?.canSeeDashboard ?? false}
      onMinimize={() => window.agilebox.shell.minimize()}
      onToggleExpand={() => window.agilebox.shell.toggleTray()}
      onClose={() => window.agilebox.shell.close()}
    >
      {view === 'projects' ? (
        <>
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
        </>
      ) : null}
    </PanelShell>
  )
}
