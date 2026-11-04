import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Drawer, Toast } from '@agilebox/ui'
import { TASK_STATUS_LABELS, type TaskStatus } from '@agilebox/core'
import { ApiError } from '@agilebox/contract'
import type { SetWipLimitsInput, TaskDto, WipLimitsDto } from '@agilebox/contract'
import { useApi } from '../shared/api/ApiProvider'
import { useActor } from '../shared/session/useActor'
import { queryKeys } from '../shared/query/keys'
import { panelCopy } from './copy'
import { useProjects } from './hooks/use-projects'
import { useSessionUsers } from './hooks/use-session-users'
import type { ProjectDto } from '@agilebox/contract'
import { AgendaView } from './agenda/AgendaView'
import { REOPEN_SETTINGS_KEY } from './settings/SettingsView'
import { DashboardView } from './dashboard/DashboardView'
import { ManagerBanner } from './board/ManagerBanner'
import { ProjectMembersDialog } from './board/ProjectMembersDialog'
import { ProjectTitle } from './board/ProjectTitle'
import { ProjectDialog } from './board/ProjectDialog'
import { NewTaskDialog } from './board/NewTaskDialog'
import { BoardView } from './board/BoardView'
import type { WipStatus } from './board/wip-limit'
import { TaskDetailView } from './task-detail/TaskDetailView'
import { PanelShell, type PanelView } from './layout/PanelShell'
import { PanelCommands } from './commands/PanelCommands'
import { useDefinitionOfDoneGate } from '../shared/definition-of-done/use-definition-of-done-gate'

export function App() {
  const [commandsOpen, setCommandsOpen] = useState(false)
  const api = useApi()
  const queryClient = useQueryClient()
  const [view, setView] = useState<PanelView>(() => {
    // Depois de trocar Translúcido/Opaco as janelas são recriadas: o painel volta em Ajustes.
    try {
      if (window.localStorage.getItem(REOPEN_SETTINGS_KEY) !== '1') return 'projects'
      window.localStorage.removeItem(REOPEN_SETTINGS_KEY)
      return 'settings'
    } catch {
      return 'projects'
    }
  })
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false)
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus | undefined>()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskFullScreen, setTaskFullScreen] = useState(false)
  const [boardException, setBoardException] = useState<'aging' | 'overdue' | 'blocked' | null>(null)
  const [viewingUser, setViewingUser] = useState<{ id: string; name: string } | null>(null)
  const [membersProject, setMembersProject] = useState<ProjectDto | null>(null)
  const [notice, setNotice] = useState<{
    id: number
    message: string
    tone: 'default' | 'warning'
  } | null>(null)
  const noticeSeq = useRef(0)
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
  const boardFlow = useQuery({
    queryKey: [...queryKeys.tasks.all, 'flow', selectedProjectId, viewingUser?.id],
    enabled: view === 'projects',
    queryFn: () =>
      api.tasks.getBoardFlow({
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(viewingUser ? { forUserId: viewingUser.id } : {}),
      }),
  })
  const allTasks = useQuery({
    queryKey: queryKeys.tasks.board(undefined, viewingUser?.id),
    queryFn: () => api.tasks.listBoard(viewingUser ? { forUserId: viewingUser.id } : {}),
  })
  const projectCounts = allTasks.data
    ? Object.fromEntries(
        (projects.data ?? []).map((project) => [
          project.id,
          allTasks.data.tasks.filter((task) => task.projectId === project.id).length,
        ]),
      )
    : undefined
  const definitionGate = useDefinitionOfDoneGate()
  const moveTask = useMutation({
    mutationFn: (input: Parameters<typeof api.tasks.move>[0]) => api.tasks.move(input),
    // O card muda de coluna na hora; se o servidor recusar, a lista volta ao que era.
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all })
      const snapshot = queryClient.getQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all })
      const movedAt = new Date().toISOString()
      queryClient.setQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all }, (current) =>
        Array.isArray(current)
          ? current.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status,
                    updatedAt: movedAt,
                    agingDays: status === 'in_progress' || status === 'review' ? 0 : null,
                    ...(status === 'done' ? { overdue: false } : {}),
                  }
                : task,
            )
          : current,
      )
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  })
  function showNotice(message: string, tone: 'default' | 'warning' = 'default') {
    noticeSeq.current += 1
    setNotice({ id: noticeSeq.current, message, tone })
  }
  /** Mover segue permitido acima do limite: a tela só avisa quando a coluna passa a ficar acima. */
  function moveTaskFromBoard(taskId: string, status: TaskStatus) {
    const task = tasks.data?.tasks.find((item) => item.id === taskId)
    if (status === 'done' && task && task.status !== 'done') {
      // Concluir passa pela conferência da definição de pronto (drag, seletor e detalhe).
      definitionGate.conclude({
        projectId: task.projectId,
        definitionOfDoneCount:
          projects.data?.find((project) => project.id === task.projectId)?.definitionOfDoneCount ??
          0,
        complete: (confirmedDefinitionItemIds) =>
          moveTask.mutateAsync({
            taskId,
            status,
            ...(confirmedDefinitionItemIds.length > 0
              ? { confirmedDefinitionItemIds: [...confirmedDefinitionItemIds] }
              : {}),
          }),
      })
      return
    }
    const column = tasks.data?.wipColumns.find((item) => item.status === status)
    moveTask.mutate(
      { taskId, status },
      {
        onSuccess: () => {
          if (
            column &&
            column.limit !== null &&
            column.state !== 'over' &&
            column.count >= column.limit
          )
            showNotice(
              panelCopy.wipLimitPassed(TASK_STATUS_LABELS[status], column.count + 1, column.limit),
              'warning',
            )
        },
      },
    )
  }
  const setWipLimit = useMutation({
    mutationFn: (input: SetWipLimitsInput) => api.boardSettings.setWipLimits(input),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]),
    onError: (error) =>
      showNotice(
        error instanceof ApiError && error.code === 'FORBIDDEN'
          ? panelCopy.forbidden
          : panelCopy.wipLimitError,
      ),
  })
  function setBoardWipLimit(status: WipStatus, limit: number | null) {
    const wipLimits: WipLimitsDto = { ...(tasks.data?.wipLimits ?? {}) }
    if (limit === null) delete wipLimits[status]
    else wipLimits[status] = limit
    setWipLimit.mutate({ wipLimits })
  }
  const switchUser = useMutation({
    mutationFn: (userId: string) => api.session.switchUser({ userId }),
    onSuccess: () => {
      setCommandsOpen(false)
      setView('projects')
      setSelectedProjectId(null)
      setActiveTaskId(null)
      setViewingUser(null)
      setMembersProject(null)
      return queryClient.invalidateQueries()
    },
  })
  function openTask(id: string) {
    setTaskFullScreen(false)
    setActiveTaskId(id)
  }
  function closeTask() {
    const card = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
      .find((element) => element.dataset.taskId === activeTaskId)
      ?.querySelector<HTMLElement>('button[aria-pressed]')
    setActiveTaskId(null)
    setTaskFullScreen(false)
    if (card) requestAnimationFrame(() => card.focus())
  }
  const isManager = actor.capabilities?.canSeeDashboard ?? false
  // Membros e definição de pronto: gestor e criador do projeto.
  const canManageProject = (project: ProjectDto) =>
    isManager || project.createdBy === actor.actor?.userId
  useEffect(() => {
    let goTo = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'k' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setCommandsOpen((open) => !open)
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing)
        return
      const target = event.target
      if (
        (target instanceof Element &&
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
          )) ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      ) {
        goTo = false
        return
      }
      if (goTo) {
        goTo = false
        if (timer) clearTimeout(timer)
        if (key === 'q' || key === 'a' || (key === 'd' && isManager)) {
          event.preventDefault()
          setView(key === 'q' ? 'projects' : key === 'a' ? 'agenda' : 'dashboard')
        }
        return
      }
      if (key === 'g') {
        goTo = true
        timer = setTimeout(() => {
          goTo = false
        }, 1000)
      }
      if (key === 'n') {
        event.preventDefault()
        setNewTaskStatus(undefined)
        setNewTaskDialogOpen(true)
        setView('projects')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timer) clearTimeout(timer)
    }
  }, [isManager])

  return (
    <>
      <PanelShell
        onSearch={() => setCommandsOpen(true)}
        projectSelector={
          <ProjectTitle
            expanded={projectDialogOpen}
            onClick={() => setProjectDialogOpen(true)}
            projectName={
              projects.data?.find((project) => project.id === selectedProjectId)?.name ??
              panelCopy.allProjects
            }
          />
        }
        managerContext={
          viewingUser ? (
            <ManagerBanner userName={viewingUser.name} onBack={() => setViewingUser(null)} />
          ) : null
        }
        view={view}
        onViewChange={setView}
        isManager={isManager}
        projects={projects.data ?? []}
        selectedProjectId={selectedProjectId}
        {...(projectCounts ? { projectCounts } : {})}
        onProjectSelect={(id) => {
          setSelectedProjectId(id)
          setActiveTaskId(null)
          setView('projects')
        }}
        onOpenTray={() => window.agilebox.shell.toggleTray()}
        account={{
          users: sessionUsers.data ?? [],
          currentUserId: actor.actor?.userId,
          onSwitch: (userId) => switchUser.mutate(userId),
        }}
        agenda={
          <AgendaView
            onOpenTask={(id) => {
              openTask(id)
              setView('projects')
            }}
          />
        }
        dashboard={
          <DashboardView
            onOpenException={(exception) => {
              setBoardException(exception)
              setViewingUser(null)
              setSelectedProjectId(null)
              setActiveTaskId(null)
              setView('projects')
            }}
            onOpenTask={(id) => {
              openTask(id)
              setView('projects')
            }}
            onOpenProjects={(user) => {
              setBoardException(null)
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
        onNewTask={() => {
          setNewTaskStatus(undefined)
          setNewTaskDialogOpen(true)
        }}
      >
        {view === 'projects' ? (
          <>
            {projects.isError ? <p role="alert">{panelCopy.projectsError}</p> : null}
            {activeTaskId && taskFullScreen ? (
              <TaskDetailView
                key={activeTaskId}
                taskId={activeTaskId}
                onBack={closeTask}
                onToggleFullScreen={() => setTaskFullScreen(false)}
                fullScreen
              />
            ) : (
              <BoardView
                key={boardException ?? 'all'}
                initialException={boardException}
                cycleDays={boardFlow.data?.cycleDays ?? null}
                flowError={boardFlow.isError}
                error={tasks.isError}
                loading={tasks.isPending}
                onCreateTask={(status) => {
                  setNewTaskStatus(status)
                  setNewTaskDialogOpen(true)
                }}
                onNewTask={() => {
                  setNewTaskStatus(undefined)
                  setNewTaskDialogOpen(true)
                }}
                refreshing={tasks.isFetching}
                selectedTaskId={activeTaskId}
                onOpenTask={openTask}
                onMoveTask={moveTaskFromBoard}
                tasks={tasks.data?.tasks}
                wipColumns={tasks.data?.wipColumns}
                canEditWipLimits={isManager}
                onSetWipLimit={setBoardWipLimit}
                updatedAt={tasks.dataUpdatedAt || undefined}
              />
            )}
            <Drawer
              open={activeTaskId !== null && !taskFullScreen}
              title={
                tasks.data?.tasks.find((task) => task.id === activeTaskId)?.title ??
                panelCopy.taskDetail
              }
              onClose={closeTask}
            >
              {activeTaskId && (
                <TaskDetailView
                  key={activeTaskId}
                  taskId={activeTaskId}
                  onBack={closeTask}
                  onToggleFullScreen={() => setTaskFullScreen(true)}
                />
              )}
            </Drawer>
            <ProjectDialog
              open={projectDialogOpen}
              projects={projects.data ?? []}
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
              onClose={() => setProjectDialogOpen(false)}
              canManageMembers={canManageProject}
              canEditDefinition={canManageProject}
              onManageMembers={setMembersProject}
            />
            <ProjectMembersDialog
              project={membersProject}
              onClose={() => setMembersProject(null)}
            />
            <NewTaskDialog
              {...(newTaskStatus ? { initialStatus: newTaskStatus } : {})}
              open={newTaskDialogOpen}
              projects={projects.data ?? []}
              selectedProjectId={selectedProjectId}
              onClose={() => setNewTaskDialogOpen(false)}
              onCreated={(createdTask) => openTask(createdTask.id)}
            />
          </>
        ) : null}
      </PanelShell>
      {notice ? <Toast key={notice.id} message={notice.message} tone={notice.tone} /> : null}
      {definitionGate.dialog}
      {commandsOpen && (
        <PanelCommands
          projects={projects.data ?? []}
          people={sessionUsers.data ?? []}
          selectedProjectId={selectedProjectId}
          isManager={isManager}
          onClose={() => setCommandsOpen(false)}
          onOpenTask={(id) => {
            openTask(id)
            setView('projects')
          }}
          onNavigate={setView}
        />
      )}
    </>
  )
}
