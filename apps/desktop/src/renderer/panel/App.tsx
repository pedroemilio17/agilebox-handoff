import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../shared/api/ApiProvider'
import { useActor } from '../shared/session/useActor'
import { queryKeys } from '../shared/query/keys'
import { panelCopy } from './copy'
import { useProjects } from './hooks/use-projects'
import { useSessionUsers } from './hooks/use-session-users'
import type { ProjectDto } from '@agilebox/contract'
import { DashboardView } from './dashboard/DashboardView'
import { ManagerBanner } from './board/ManagerBanner'
import { ProjectMembersDialog } from './board/ProjectMembersDialog'
import { ProjectTitle } from './board/ProjectTitle'
import { ProjectDialog } from './board/ProjectDialog'
import { NewTaskDialog } from './board/NewTaskDialog'
import { BoardView } from './board/BoardView'
import { TaskDetailView } from './task-detail/TaskDetailView'
import { PanelShell, type PanelView } from './layout/PanelShell'
import styles from './App.module.css'

export function App() {
  const api = useApi()
  const queryClient = useQueryClient()
  const [view, setView] = useState<PanelView>('projects')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [viewingUser, setViewingUser] = useState<{ id: string; name: string } | null>(null)
  const [membersProject, setMembersProject] = useState<ProjectDto | null>(null)
  const actor = useActor()
  const projects = useProjects()
  const sessionUsers = useSessionUsers()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(selectedProjectId ?? undefined, viewingUser?.id),
    queryFn: () =>
      api.tasks.listBoard({
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(viewingUser ? { forUserId: viewingUser.id } : {}),
      }),
  })
  const moveTask = useMutation({
    mutationFn: (input: Parameters<typeof api.tasks.move>[0]) => api.tasks.move(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  })

  const switchUser = useMutation({
    mutationFn: (userId: string) => api.session.switchUser({ userId }),
    onSuccess: () => {
      setView('projects')
      setSelectedProjectId(null)
      setActiveTaskId(null)
      setViewingUser(null)
      setMembersProject(null)
      return queryClient.invalidateQueries()
    },
  })
  const isManager = actor.capabilities?.canSeeDashboard ?? false

  return (
    <PanelShell
      view={view}
      onViewChange={setView}
      isManager={isManager}
      account={{
        users: sessionUsers.data ?? [],
        currentUserId: actor.actor?.userId,
        onSwitch: (userId) => switchUser.mutate(userId),
      }}
      dashboard={
        <DashboardView
          onOpenProjects={(user) => {
            setViewingUser({ id: user.id, name: user.name })
            setSelectedProjectId(null)
            setActiveTaskId(null)
            setView('projects')
          }}
        />
      }
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
          {viewingUser ? (
            <ManagerBanner userName={viewingUser.name} onBack={() => setViewingUser(null)} />
          ) : null}
          {activeTaskId ? (
            <TaskDetailView taskId={activeTaskId} onBack={() => setActiveTaskId(null)} />
          ) : (
            <BoardView
              error={tasks.isError}
              loading={tasks.isPending}
              onOpenTask={setActiveTaskId}
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
            canManageMembers={(project) => isManager || project.createdBy === actor.actor?.userId}
            onManageMembers={setMembersProject}
          />
          <ProjectMembersDialog project={membersProject} onClose={() => setMembersProject(null)} />
          <NewTaskDialog
            open={newTaskDialogOpen}
            projects={projects.data ?? []}
            selectedProjectId={selectedProjectId}
            onClose={() => setNewTaskDialogOpen(false)}
            onCreated={(createdTask) => setActiveTaskId(createdTask.id)}
          />
        </>
      ) : null}
    </PanelShell>
  )
}
