import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, ScopeBanner, Toast } from '@agilebox/ui'
import { TASK_STATUS_LABELS, type TaskStatus } from '@agilebox/core'
import { ApiError } from '@agilebox/contract'
import type { SetWipLimitsInput, SprintDetailDto, TaskDto, WipLimitsDto } from '@agilebox/contract'
import { useApi } from '../shared/api/ApiProvider'
import { CapabilitiesProvider } from '../shared/capabilities/CapabilitiesProvider'
import { useCapabilities } from '../shared/capabilities/capabilities-context'
import { useActor } from '../shared/session/useActor'
import { queryKeys } from '../shared/query/keys'
import { panelCopy } from './copy'
import { useProjects } from './hooks/use-projects'
import { useSessionUsers } from './hooks/use-session-users'
import type { ProjectDto } from '@agilebox/contract'
import { AgendaView } from './agenda/AgendaView'
import { BacklogView } from './backlog/BacklogView'
import { WbsView } from './wbs/WbsView'
import { MilestonesView } from './milestones/MilestonesView'
import { RisksView } from './risks/RisksView'
import { ScheduleView } from './schedule/ScheduleView'
import { TrackingView } from './tracking/TrackingView'
import { BaselineView } from './baseline/BaselineView'
import { BurndownView } from './burndown/BurndownView'
import { FlowMetricsView } from './flow-metrics/FlowMetricsView'
import { SprintsView } from './sprints/SprintsView'
import { PlanView } from './plan/PlanView'
import { PlanSprintView } from './plan/PlanSprintView'
import { ImpedimentsView } from './impediments/ImpedimentsView'
import { summarizeModules } from './modules/modules-screen'
import { ProjectConfigView } from './project-config/ProjectConfigView'
import { ProjectHomeView } from './project-home/ProjectHomeView'
import { projectNameKey } from './project-config/project-name-key'
import { useProjectModules } from './hooks/use-project-modules'
import { useCreateProjectWithSetup } from './hooks/use-create-project-with-setup'
import { applyTaskStatusToSprintDetail, useSprintList } from './sprints/use-sprints'
import { REOPEN_SETTINGS_KEY } from './settings/SettingsView'
import { DashboardView } from './dashboard/DashboardView'
import { UpdatesView } from './dashboard/UpdatesView'
import { ManagerBanner } from './board/ManagerBanner'
import { NewProjectFlow, type NewProjectPayload } from './new-project/NewProjectFlow'
import { refusalMessage } from './backlog/refusal-message'
import { NewTaskDialog } from './board/NewTaskDialog'
import { BoardView } from './board/BoardView'
import type { WipStatus } from './board/wip-limit'
import type { TaskScope } from './board/task-scope'
import { teamWipColumns } from './board/team-board'
import { ScopeAnnouncement } from './board/ScopeAnnouncement'
import { TaskDetailView } from './task-detail/TaskDetailView'
import { PanelShell, type PanelView } from './layout/PanelShell'
import { popNavHistory, pushNavHistory, type NavEntry } from './layout/nav-history'
import { PanelCommands } from './commands/PanelCommands'
import { KanAssistant } from './kan/KanAssistant'
import { useDefinitionOfDoneGate } from '../shared/definition-of-done/use-definition-of-done-gate'

export function App() {
  // O projeto selecionado fica aqui para o Provider decidir os módulos pelo projeto (ADR-10).
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  return (
    <CapabilitiesProvider selectedProjectId={selectedProjectId}>
      <PanelContent selectedProjectId={selectedProjectId} onSelectProject={setSelectedProjectId} />
    </CapabilitiesProvider>
  )
}

function PanelContent({
  selectedProjectId,
  onSelectProject: setSelectedProjectId,
}: {
  readonly selectedProjectId: string | null
  readonly onSelectProject: (projectId: string | null) => void
}) {
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [kanOpen, setKanOpen] = useState(false)
  const api = useApi()
  const capabilities = useCapabilities()
  // Agenda só aparece com o módulo ligado e o nível da pessoa; a view guardada cai no Quadro.
  const agendaVisible = capabilities.showScreen('agenda')
  // Backlog segue o mesmo caminho: módulo ligado e nível da pessoa; senão a view cai no Quadro.
  const backlogVisible = capabilities.showScreen('backlog')
  // Entregas (EAP): módulo ligado no projeto selecionado; sem projeto a view cai no Quadro.
  const wbsVisible = selectedProjectId !== null && capabilities.showScreen('wbs')
  // Marcos: mesmo caminho (módulo ligado no projeto selecionado; sem projeto cai no Quadro).
  const milestonesVisible = selectedProjectId !== null && capabilities.showScreen('milestones')
  // Cronograma: módulo ligado no projeto selecionado; sem projeto a view cai no Quadro.
  const scheduleVisible = selectedProjectId !== null && capabilities.showScreen('schedule')
  // Acompanhamento: mesmo módulo do cronograma, com projeto selecionado; senão a view cai no Quadro.
  const trackingVisible = selectedProjectId !== null && capabilities.showScreen('schedule')
  // Linha de base: módulo `baseline` ligado no projeto selecionado; senão a view cai no Quadro.
  const baselineVisible = selectedProjectId !== null && capabilities.showScreen('baseline')
  // Burndown e velocidade: módulo `burndown` ligado no projeto selecionado; senão a view cai no Quadro.
  const burndownVisible = selectedProjectId !== null && capabilities.showScreen('burndown')
  // Métricas de fluxo: módulo `flowMetrics` ligado no projeto selecionado; senão a view cai no Quadro.
  const flowMetricsVisible = selectedProjectId !== null && capabilities.showScreen('flowMetrics')
  // Riscos: módulo `risks` ligado no projeto selecionado; sem projeto a view cai no Quadro.
  const risksVisible = selectedProjectId !== null && capabilities.showScreen('risks')
  // Sprints segue o mesmo caminho: módulo ligado (ou encerrando) e nível da pessoa.
  const sprintsVisible = capabilities.showScreen('sprints')
  // Plano (híbrido, tela 17): precisa da EAP e das sprints ligadas no projeto selecionado.
  const planVisible =
    selectedProjectId !== null &&
    capabilities.showScreen('wbs') &&
    capabilities.showScreen('sprints')
  // Impedimentos: mesmo caminho (módulo ligado ou encerrando, e nível da pessoa).
  const impedimentsVisible = capabilities.showScreen('impediments')
  const flowFetch = capabilities.canFetch('flowMetrics:screen')
  const queryClient = useQueryClient()
  // Sprint aberta a partir do plano (tela 18): a sprint e a entrega em que ela está aberta.
  const [planSprint, setPlanSprint] = useState<{
    readonly sprintId: string
    readonly deliverableId: string | null
  } | null>(null)
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
  // Módulos existe só com projeto selecionado; sem ele, a view guardada cai no Quadro.
  const currentView: PanelView =
    (view === 'agenda' && !agendaVisible) ||
    (view === 'backlog' && !backlogVisible) ||
    (view === 'wbs' && !wbsVisible) ||
    (view === 'milestones' && !milestonesVisible) ||
    (view === 'schedule' && !scheduleVisible) ||
    (view === 'tracking' && !trackingVisible) ||
    (view === 'baseline' && !baselineVisible) ||
    (view === 'burndown' && !burndownVisible) ||
    (view === 'flowMetrics' && !flowMetricsVisible) ||
    (view === 'risks' && !risksVisible) ||
    (view === 'sprints' && !sprintsVisible) ||
    (view === 'plan' && !planVisible) ||
    (view === 'planSprint' && (!planVisible || planSprint === null)) ||
    (view === 'impediments' && !impedimentsVisible) ||
    (view === 'home' && selectedProjectId === null) ||
    (view === 'modules' && selectedProjectId === null)
      ? 'projects'
      : view
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [navHistory, setNavHistory] = useState<readonly NavEntry[]>([])
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false)
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus | undefined>()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskFullScreen, setTaskFullScreen] = useState(false)
  const [boardException, setBoardException] = useState<'aging' | 'overdue' | 'blocked' | null>(null)
  const [viewingUser, setViewingUser] = useState<{ id: string; name: string } | null>(null)
  // Escopo do quadro só em memória da sessão: a Equipe é somente leitura e não grava nada.
  const [taskScope, setTaskScope] = useState<TaskScope>('mine')
  const [scopeAnnouncement, setScopeAnnouncement] = useState('')
  const createProject = useCreateProjectWithSetup()
  // Arquivados ficam ocultos por padrão; cada tela pede só quando o usuário liga o filtro.
  const [showArchived, setShowArchived] = useState(false)
  const [showArchivedProjects, setShowArchivedProjects] = useState(false)
  const [notice, setNotice] = useState<{
    id: number
    message: string
    tone: 'default' | 'warning'
  } | null>(null)
  const noticeSeq = useRef(0)
  const actor = useActor()
  const projects = useProjects(showArchivedProjects)
  // Projeto arquivado não recebe tarefa nova: a criação só oferece os ativos.
  const activeProjects = useMemo(
    () => (projects.data ?? []).filter((project) => project.archivedAt == null),
    [projects.data],
  )
  const selectedProject = projects.data?.find((project) => project.id === selectedProjectId)
  const selectedArchived = selectedProject?.archivedAt != null
  const newTaskBlockedReason = selectedArchived ? panelCopy.archivedProjectNewTask : undefined
  const sessionUsers = useSessionUsers()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(selectedProjectId ?? undefined, viewingUser?.id, showArchived),
    queryFn: () =>
      api.tasks.listBoard({
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(viewingUser ? { forUserId: viewingUser.id } : {}),
        ...(showArchived ? { includeArchived: true } : {}),
      }),
  })
  const teamTasks = useQuery({
    queryKey: queryKeys.tasks.team(selectedProjectId ?? undefined, showArchived),
    queryFn: () =>
      api.tasks.listTeamBoard({
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(showArchived ? { includeArchived: true } : {}),
      }),
    enabled: currentView === 'projects' && taskScope === 'team',
  })
  const teamView = taskScope === 'team'
  const boardTasks = teamView ? teamTasks.data : tasks.data?.tasks
  const boardWipColumns = teamView
    ? teamWipColumns(teamTasks.data ?? [], tasks.data?.wipLimits)
    : tasks.data?.wipColumns
  function changeTaskScope(scope: TaskScope) {
    if (scope === taskScope) return
    setTaskScope(scope)
    // O detalhe aberto pertencia à outra visão: fecha para não misturar edição e leitura.
    setActiveTaskId(null)
    setTaskFullScreen(false)
    setScopeAnnouncement(
      scope === 'team' ? panelCopy.teamViewAnnouncement : panelCopy.myTasksAnnouncement,
    )
  }
  const boardFlow = useQuery({
    queryKey: [...queryKeys.tasks.all, 'flow', selectedProjectId, viewingUser?.id],
    // Sem a ferramenta de métricas de fluxo o backend recusa a consulta: nem tenta.
    enabled: currentView === 'projects' && flowFetch,
    queryFn: () =>
      api.tasks.getBoardFlow({
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(viewingUser ? { forUserId: viewingUser.id } : {}),
      }),
  })
  // Barra lateral: sprint ativa (S4) e quantos módulos estão ligados no projeto selecionado.
  const projectModules = useProjectModules(selectedProjectId)
  const projectModuleCount = projectModules.data
    ? summarizeModules(projectModules.data.modules).enabled
    : null
  const sprintList = useSprintList(selectedProjectId)
  const activeSprintNumber =
    sprintList.data?.find((sprint) => sprint.status === 'active')?.number ?? null
  const definitionGate = useDefinitionOfDoneGate()
  const moveTask = useMutation({
    mutationFn: (input: Parameters<typeof api.tasks.move>[0]) => api.tasks.move(input),
    // O card muda de coluna na hora; se o servidor recusar, quadro e sprint voltam ao que eram.
    onMutate: async ({ taskId, status }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.sprints.all }),
      ])
      const snapshot = queryClient.getQueriesData<TaskDto[]>({ queryKey: queryKeys.tasks.all })
      const sprintSnapshot = queryClient.getQueriesData<SprintDetailDto>({
        queryKey: queryKeys.sprints.all,
      })
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
      queryClient.setQueriesData<SprintDetailDto>({ queryKey: queryKeys.sprints.all }, (current) =>
        applyTaskStatusToSprintDetail(current, taskId, status, movedAt),
      )
      return { snapshot, sprintSnapshot }
    },
    onError: (error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
      for (const [key, data] of context?.sprintSnapshot ?? []) queryClient.setQueryData(key, data)
      if (error instanceof ApiError && error.code === 'FORBIDDEN') {
        showNotice(panelCopy.forbidden, 'warning')
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.guide.all }),
      ]),
  })
  function showNotice(message: string, tone: 'default' | 'warning' = 'default') {
    noticeSeq.current += 1
    setNotice({ id: noticeSeq.current, message, tone })
  }
  /** Mover segue permitido acima do limite: a tela só avisa quando a coluna passa a ficar acima. */
  function moveTaskFromBoard(taskId: string, status: TaskStatus, fallbackTask?: TaskDto) {
    const task = fallbackTask ?? tasks.data?.tasks.find((item) => item.id === taskId)
    if (status === 'done' && task && task.status !== 'done') {
      // Concluir passa pela conferência da definição de pronto (drag, seletor e detalhe).
      definitionGate.conclude({
        projectId: task.projectId,
        taskLabel: `${task.key} · ${task.title}`,
        returnTo: TASK_STATUS_LABELS[task.status],
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
  function navigate(nextView: PanelView, nextProjectId: string | null = selectedProjectId) {
    setNavHistory((history) =>
      pushNavHistory(
        history,
        { view: currentView, projectId: selectedProjectId },
        { view: nextView, projectId: nextProjectId },
      ),
    )
    if (nextProjectId !== selectedProjectId) {
      setSelectedProjectId(nextProjectId)
      setActiveTaskId(null)
      setTaskFullScreen(false)
    }
    // Novo projeto é uma página: qualquer navegação pela casca a fecha.
    setNewProjectOpen(false)
    setView(nextView)
  }

  function goBack() {
    if (activeTaskId !== null && taskFullScreen) {
      closeTask()
      return
    }
    const { entry, rest } = popNavHistory(navHistory)
    if (!entry) return
    setNavHistory(rest)
    if (entry.projectId !== selectedProjectId) {
      setSelectedProjectId(entry.projectId)
    }
    setActiveTaskId(null)
    setTaskFullScreen(false)
    setView(entry.view)
  }

  async function createProjectFromWizard(payload: NewProjectPayload) {
    const duplicate = (projects.data ?? []).find(
      (project) => projectNameKey(project.name) === projectNameKey(payload.name),
    )
    if (duplicate) {
      createProject.reset()
      setNewProjectOpen(false)
      navigate('projects', duplicate.id)
      return
    }
    try {
      const created = await createProject.mutateAsync(payload)
      setNewProjectOpen(false)
      navigate('projects', created.id)
    } catch {
      // A mensagem aparece no próprio assistente, que continua aberto.
    }
  }

  const switchUser = useMutation({
    mutationFn: (userId: string) => api.session.switchUser({ userId }),
    onSuccess: () => {
      setCommandsOpen(false)
      setNewProjectOpen(false)
      setNavHistory([])
      setView('projects')
      setSelectedProjectId(null)
      setActiveTaskId(null)
      setTaskFullScreen(false)
      setViewingUser(null)
      setTaskScope('mine')
      return queryClient.invalidateQueries()
    },
  })
  function openTray() {
    window.agilebox.shell.toggleTray()
  }
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
  const navActionsRef = useRef({ navigate, goBack })
  navActionsRef.current = { navigate, goBack }
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
      const target = event.target
      const blockedByFocusOrModal =
        (target instanceof Element &&
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
          )) ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      if (event.altKey && event.key === 'ArrowLeft' && !event.ctrlKey && !event.metaKey) {
        if (blockedByFocusOrModal) return
        event.preventDefault()
        navActionsRef.current.goBack()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing)
        return
      if (blockedByFocusOrModal) {
        goTo = false
        return
      }
      if (goTo) {
        goTo = false
        if (timer) clearTimeout(timer)
        if (
          key === 'q' ||
          (key === 'b' && backlogVisible) ||
          (key === 's' && sprintsVisible) ||
          (key === 'i' && impedimentsVisible) ||
          (key === 'a' && agendaVisible) ||
          (key === 'd' && isManager)
        ) {
          event.preventDefault()
          navActionsRef.current.navigate(
            key === 'q'
              ? 'projects'
              : key === 'b'
                ? 'backlog'
                : key === 's'
                  ? 'sprints'
                  : key === 'i'
                    ? 'impediments'
                    : key === 'a'
                      ? 'agenda'
                      : 'dashboard',
          )
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
        navActionsRef.current.navigate('projects')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timer) clearTimeout(timer)
    }
  }, [isManager, agendaVisible, backlogVisible, sprintsVisible, impedimentsVisible])

  return (
    <>
      <PanelShell
        onSearch={() => setCommandsOpen(true)}
        kanOpen={kanOpen}
        onToggleKan={() => setKanOpen((prev) => !prev)}
        managerContext={
          viewingUser ? (
            <ManagerBanner userName={viewingUser.name} onBack={() => setViewingUser(null)} />
          ) : null
        }
        view={newProjectOpen ? 'projects' : currentView}
        onViewChange={(next) => navigate(next)}
        canGoBack={navHistory.length > 0 || (activeTaskId !== null && taskFullScreen)}
        onBack={goBack}
        taskScope={taskScope}
        onTaskScopeChange={changeTaskScope}
        isManager={isManager}
        projects={projects.data ?? []}
        selectedProjectId={selectedProjectId}
        newTaskBlockedReason={newTaskBlockedReason}
        activeSprintNumber={activeSprintNumber}
        projectModuleCount={projectModuleCount}
        onProjectSelect={(id) => {
          setBoardException(null)
          navigate('projects', id)
        }}
        onNewProject={() => {
          createProject.reset()
          setNewProjectOpen(true)
        }}
        showArchivedProjects={showArchivedProjects}
        onShowArchivedProjectsChange={(show) => {
          setShowArchivedProjects(show)
          // Escondido o projeto selecionado, o quadro volta a todos os projetos.
          if (!show && selectedArchived) navigate('projects', null)
        }}
        onOpenTray={openTray}
        account={{
          users: sessionUsers.data ?? [],
          currentUserId: actor.actor?.userId,
          onSwitch: (userId) => switchUser.mutate(userId),
        }}
        backlog={
          <BacklogView
            initialProjectId={selectedProjectId}
            projects={activeProjects}
            isManager={isManager}
            onNavigate={(next) => navigate(next)}
          />
        }
        wbs={
          <WbsView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onNavigate={(next) => navigate(next)}
          />
        }
        plan={
          <PlanView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onOpenSprint={(sprintId, deliverableId) => {
              setPlanSprint({ sprintId, deliverableId })
              navigate('planSprint')
            }}
          />
        }
        planSprint={
          selectedProjectId !== null && planSprint !== null ? (
            <PlanSprintView
              key={planSprint.sprintId}
              projectId={selectedProjectId}
              sprintId={planSprint.sprintId}
              deliverableId={planSprint.deliverableId}
              showEstimates={capabilities.can('estimates.hours:passive')}
              onBack={() => navigate('plan')}
              onOpenTask={(id) => {
                openTask(id)
                navigate('projects')
              }}
              onNewTask={() => {
                setNewTaskStatus(undefined)
                setNewTaskDialogOpen(true)
              }}
              onMoveTask={(task, status) => moveTaskFromBoard(task.id, status, task)}
            />
          ) : null
        }
        risks={
          <RisksView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onNavigate={(next) => navigate(next)}
          />
        }
        home={
          selectedProjectId !== null ? (
            <ProjectHomeView
              key={selectedProjectId}
              projectId={selectedProjectId}
              projectName={selectedProject?.name ?? null}
              newTaskBlockedReason={newTaskBlockedReason}
              onNavigate={(next) => navigate(next)}
              onNewTask={() => {
                setNewTaskStatus(undefined)
                setNewTaskDialogOpen(true)
              }}
              onOpenTask={(id) => {
                openTask(id)
                navigate('projects')
              }}
            />
          ) : null
        }
        milestones={
          <MilestonesView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onNavigate={(next) => navigate(next)}
          />
        }
        schedule={
          <ScheduleView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onNavigate={(next) => navigate(next)}
          />
        }
        tracking={
          <TrackingView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onNavigate={(next) => navigate(next)}
          />
        }
        baseline={
          <BaselineView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onNavigate={(next) => navigate(next)}
          />
        }
        burndown={
          <BurndownView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            onNavigate={(next) => navigate(next)}
          />
        }
        flowMetrics={
          <FlowMetricsView
            key={selectedProjectId ?? 'none'}
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? null}
            onNavigate={(next) => navigate(next)}
          />
        }
        sprints={
          <SprintsView
            initialProjectId={selectedProjectId}
            projects={activeProjects}
            isManager={isManager}
            onNavigate={(next) => navigate(next)}
            onOpenTask={(id) => {
              openTask(id)
              navigate('projects')
            }}
            onNewTask={() => {
              setNewTaskStatus(undefined)
              setNewTaskDialogOpen(true)
            }}
            onMoveTask={(task, status) => moveTaskFromBoard(task.id, status, task)}
          />
        }
        impediments={
          <ImpedimentsView
            selectedProjectId={selectedProjectId}
            onNavigate={(next) => navigate(next)}
            onOpenTask={(id) => {
              openTask(id)
              navigate('projects')
            }}
          />
        }
        agenda={
          <AgendaView
            selectedProjectId={selectedProjectId}
            onNavigate={(next) => navigate(next)}
            onOpenTask={(id) => {
              openTask(id)
              navigate('projects')
            }}
          />
        }
        modules={
          <ProjectConfigView
            project={selectedProject ?? null}
            projects={projects.data ?? []}
            canManage={selectedProject !== undefined && canManageProject(selectedProject)}
            onNavigate={(next) => navigate(next)}
          />
        }
        dashboard={
          <DashboardView
            onNotice={showNotice}
            onOpenException={(exception) => {
              setBoardException(exception)
              setViewingUser(null)
              navigate('projects', null)
            }}
            onOpenTask={(id) => {
              openTask(id)
              navigate('projects')
            }}
            onOpenProject={(projectId, screen) => {
              setBoardException(null)
              setViewingUser(null)
              navigate(screen === 'board' ? 'projects' : 'schedule', projectId)
            }}
            onOpenUpdates={() => navigate('updates')}
            onOpenProjects={(user) => {
              setBoardException(null)
              setViewingUser({ id: user.id, name: user.name })
              navigate('projects', null)
            }}
          />
        }
        updates={
          <UpdatesView
            onOpenTask={(id) => {
              openTask(id)
              navigate('projects')
            }}
            onOpenProject={(projectId, screen) => {
              setBoardException(null)
              setViewingUser(null)
              navigate(screen === 'board' ? 'projects' : 'schedule', projectId)
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
        {newProjectOpen ? (
          <NewProjectFlow
            submitting={createProject.isPending}
            error={
              createProject.isError
                ? refusalMessage(createProject.error, panelCopy.createProjectError)
                : null
            }
            onCancel={() => {
              createProject.reset()
              setNewProjectOpen(false)
            }}
            onCreate={createProjectFromWizard}
          />
        ) : currentView === 'projects' ? (
          <>
            {projects.isError ? <p role="alert">{panelCopy.projectsError}</p> : null}
            {activeTaskId && taskFullScreen ? (
              <TaskDetailView
                key={activeTaskId}
                taskId={activeTaskId}
                onBack={closeTask}
                onToggleFullScreen={() => setTaskFullScreen(false)}
                fullScreen
                readOnlyScope={teamView}
              />
            ) : (
              <>
                <ScopeAnnouncement message={scopeAnnouncement} />
                {teamView ? <ScopeBanner>{panelCopy.teamViewBanner}</ScopeBanner> : null}
                <BoardView
                  key={boardException ?? 'all'}
                  initialException={boardException}
                  cycleDays={boardFlow.data?.cycleDays ?? null}
                  flowError={boardFlow.isError}
                  error={teamView ? teamTasks.isError : tasks.isError}
                  loading={teamView ? teamTasks.isPending : tasks.isPending}
                  onCreateTask={(status) => {
                    setNewTaskStatus(status)
                    setNewTaskDialogOpen(true)
                  }}
                  onNewTask={() => {
                    setNewTaskStatus(undefined)
                    setNewTaskDialogOpen(true)
                  }}
                  refreshing={teamView ? teamTasks.isFetching : tasks.isFetching}
                  selectedTaskId={activeTaskId}
                  onOpenTask={openTask}
                  onMoveTask={moveTaskFromBoard}
                  tasks={boardTasks}
                  wipColumns={boardWipColumns}
                  canEditWipLimits={isManager}
                  onSetWipLimit={setBoardWipLimit}
                  readOnlyScope={teamView}
                  onRetry={() => void teamTasks.refetch()}
                  showArchived={showArchived}
                  onShowArchivedChange={setShowArchived}
                  newTaskBlockedReason={newTaskBlockedReason}
                  updatedAt={
                    (teamView ? teamTasks.dataUpdatedAt : tasks.dataUpdatedAt) || undefined
                  }
                />
              </>
            )}
            <Drawer
              open={activeTaskId !== null && !taskFullScreen}
              title={
                boardTasks?.find((task) => task.id === activeTaskId)?.title ?? panelCopy.taskDetail
              }
              onClose={closeTask}
            >
              {activeTaskId && (
                <TaskDetailView
                  key={activeTaskId}
                  taskId={activeTaskId}
                  onBack={closeTask}
                  onToggleFullScreen={() => setTaskFullScreen(true)}
                  readOnlyScope={teamView}
                />
              )}
            </Drawer>
          </>
        ) : null}
      </PanelShell>
      <NewTaskDialog
        {...(newTaskStatus ? { initialStatus: newTaskStatus } : {})}
        open={newTaskDialogOpen}
        projects={activeProjects}
        selectedProjectId={selectedArchived ? null : selectedProjectId}
        onClose={() => setNewTaskDialogOpen(false)}
        onCreated={(createdTask) => {
          openTask(createdTask.id)
          if (currentView !== 'projects') navigate('projects')
        }}
      />
      {notice ? <Toast key={notice.id} message={notice.message} tone={notice.tone} /> : null}
      {definitionGate.dialog}
      {commandsOpen && (
        <PanelCommands
          projects={activeProjects}
          people={sessionUsers.data ?? []}
          selectedProjectId={selectedProjectId}
          isManager={isManager}
          onClose={() => setCommandsOpen(false)}
          onOpenTask={(id) => {
            openTask(id)
            navigate('projects')
          }}
          onNavigate={(next) => navigate(next)}
        />
      )}
      <KanAssistant
        open={kanOpen}
        onOpenChange={setKanOpen}
        currentView={currentView}
        selectedProject={selectedProject ?? null}
        activeProjects={activeProjects}
        boardTasks={boardTasks ?? []}
        users={sessionUsers.data ?? []}
        actor={{
          userId: actor.actor?.userId,
          name:
            sessionUsers.data?.find((u) => u.id === actor.actor?.userId)?.name ??
            (isManager ? 'Gestor' : 'Colaborador'),
          isManager,
        }}
        onNotice={(message) => showNotice(message)}
      />
    </>
  )
}
