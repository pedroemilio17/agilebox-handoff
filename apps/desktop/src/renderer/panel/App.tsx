import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { TaskDto } from '@agilebox/contract'
import { useApi } from '../shared/api/ApiProvider'
import { useActor } from '../shared/session/useActor'
import { queryKeys } from '../shared/query/keys'
import { panelCopy } from './copy'
import { useProjects } from './hooks/use-projects'
import { ProjectTitle } from './board/ProjectTitle'
import { ProjectDialog } from './board/ProjectDialog'
import { NewTaskDialog } from './board/NewTaskDialog'
import { BoardView } from './board/BoardView'
import { PanelShell, type PanelView } from './layout/PanelShell'
import styles from './App.module.css'

export function App() {
  const api = useApi()
  const queryClient = useQueryClient()
  const [view, setView] = useState<PanelView>('projects')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null)
  const actor = useActor()
  const projects = useProjects()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(selectedProjectId ?? undefined),
    queryFn: () => api.tasks.listBoard(selectedProjectId ? { projectId: selectedProjectId } : {}),
  })
  const moveTask = useMutation({
    mutationFn: (input: Parameters<typeof api.tasks.move>[0]) => api.tasks.move(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  })

  return (
    <PanelShell
      view={view}
      onViewChange={setView}
      isManager={actor.capabilities?.canSeeDashboard ?? false}
      onMinimize={() => window.agilebox.shell.minimize()}
      onToggleExpand={() => window.agilebox.shell.toggleTray()}
      onClose={() => window.agilebox.shell.close()}
      onNewTask={() => setNewTaskDialogOpen(true)}
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
          {activeTask ? (
            <section aria-label={panelCopy.taskDetail} className={styles.taskDetail} role="region">
              <button type="button" onClick={() => setActiveTask(null)}>
                {panelCopy.backToBoard}
              </button>
              <h2>{activeTask.title}</h2>
              <p>{panelCopy.taskDetailComingSoon}</p>
            </section>
          ) : (
            <BoardView
              error={tasks.isError}
              loading={tasks.isPending}
              onOpenTask={(taskId) => void api.tasks.recordOpen({ taskId })}
              onMoveTask={(taskId, status) => moveTask.mutate({ taskId, status })}
              tasks={tasks.data}
            />
          )}
          <ProjectDialog
            open={projectDialogOpen}
            projects={projects.data ?? []}
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
            onClose={() => setProjectDialogOpen(false)}
          />
          <NewTaskDialog
            open={newTaskDialogOpen}
            projects={projects.data ?? []}
            selectedProjectId={selectedProjectId}
            onClose={() => setNewTaskDialogOpen(false)}
            onCreated={(createdTask) => {
              setActiveTask(createdTask)
              void api.tasks.recordOpen({ taskId: createdTask.id }).catch(() => undefined)
            }}
          />
        </>
      ) : null}
    </PanelShell>
  )
}
