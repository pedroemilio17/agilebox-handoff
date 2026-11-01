import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../shared/api/ApiProvider'
import { useActor } from '../shared/session/useActor'
import { queryKeys } from '../shared/query/keys'
import { panelCopy } from './copy'
import { useProjects } from './hooks/use-projects'
import { ProjectTitle } from './board/ProjectTitle'
import { ProjectDialog } from './board/ProjectDialog'
import { BoardView } from './board/BoardView'
import { PanelShell, type PanelView } from './layout/PanelShell'
import styles from './App.module.css'

export function App() {
  const api = useApi()
  const [view, setView] = useState<PanelView>('projects')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const actor = useActor()
  const projects = useProjects()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(selectedProjectId ?? undefined),
    queryFn: () => api.tasks.listBoard(selectedProjectId ? { projectId: selectedProjectId } : {}),
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
          <div className={styles.projectHeader}>
            <ProjectTitle
              expanded={projectDialogOpen}
              onClick={() => setProjectDialogOpen(true)}
              projectName={
                projects.data?.find((project) => project.id === selectedProjectId)?.name ??
                panelCopy.allProjects
              }
            />
            {projects.isError ? <p role="alert">{panelCopy.projectsError}</p> : null}
          </div>
          <BoardView
            error={tasks.isError}
            loading={tasks.isPending}
            onOpenTask={(taskId) => void api.tasks.recordOpen({ taskId })}
            tasks={tasks.data}
          />
          <ProjectDialog
            open={projectDialogOpen}
            projects={projects.data ?? []}
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
            onClose={() => setProjectDialogOpen(false)}
          />
        </>
      ) : null}
    </PanelShell>
  )
}
