import { useEffect, useState, type ReactNode } from 'react'
import { EmptyState, WindowControls, ProjectSwatch, Kbd, SegmentedControl } from '@agilebox/ui'
import type { ProjectPresetKey } from '@agilebox/core'
import type { SessionUserDto } from '@agilebox/contract'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import type { TaskScope } from '../board/task-scope'
import { panelCopy } from '../copy'
import { AccountMenu } from './AccountMenu'
import { methodologyLabel } from './methodology-label'
import { SettingsView } from '../settings/SettingsView'
import { sprintCopy } from '../sprints/sprint-copy'
import { impedimentCopy } from '../impediments/impediment-copy'
import { trackingCopy } from '../tracking/tracking-screen'
import { baselineCopy } from '../baseline/baseline-screen'
import { burndownCopy } from '../burndown/burndown-screen'
import { flowMetricsCopy } from '../flow-metrics/flow-metrics-screen'
import { planCopy } from '../plan/plan-screen'
import { swatchIndexOf } from '../../shared/lib/project-swatch'
import {
  buildProjectNavGroups,
  findActiveProjectNavGroup,
  isProjectScopedView,
  type ProjectNavGroup,
} from './project-nav'
import { TopicTabs } from './TopicTabs'
import { PredictiveLayout } from '../predictive/PredictiveLayout'
import styles from './PanelShell.module.css'

export type PanelView =
  | 'home'
  | 'dashboard'
  | 'updates'
  | 'projects'
  | 'backlog'
  | 'wbs'
  | 'milestones'
  | 'schedule'
  | 'tracking'
  | 'baseline'
  | 'burndown'
  | 'flowMetrics'
  | 'risks'
  | 'sprints'
  | 'plan'
  | 'planSprint'
  | 'impediments'
  | 'agenda'
  | 'modules'
  | 'plugins'
  | 'settings'

export interface RailProject {
  readonly id: string
  readonly name: string
  readonly archivedAt?: string | null | undefined
  /** Preset em que o projeto começou: dá o rótulo da metodologia na barra. */
  readonly startedFromPreset?: ProjectPresetKey | null | undefined
}

export interface PanelShellProps {
  readonly managerContext?: ReactNode
  readonly view: PanelView
  readonly isManager: boolean
  readonly onViewChange: (view: PanelView) => void
  readonly canGoBack?: boolean
  readonly onBack?: () => void
  readonly onMinimize: () => void
  readonly onToggleExpand: () => void
  readonly onClose: () => void
  readonly onNewTask: () => void
  /** Motivo para desabilitar "Nova tarefa" (ex.: projeto arquivado selecionado). */
  readonly newTaskBlockedReason?: string | undefined
  readonly projects?: readonly RailProject[]
  readonly selectedProjectId?: string | null
  readonly onProjectSelect?: (id: string | null) => void
  /** "Novo projeto" na barra: abre o assistente de criação de projeto. */
  readonly onNewProject?: () => void
  readonly showArchivedProjects?: boolean
  readonly onShowArchivedProjectsChange?: (show: boolean) => void
  /** Número da sprint ativa do projeto selecionado (ex.: "S4" no subitem Sprints). */
  readonly activeSprintNumber?: number | null
  /** Quantos módulos estão ligados no projeto selecionado (contagem do subitem Configurações). */
  readonly projectModuleCount?: number | null
  readonly onSearch?: () => void
  readonly onOpenTray?: () => void
  readonly account?: {
    readonly users: readonly SessionUserDto[]
    readonly currentUserId: string | undefined
    readonly onSwitch: (userId: string) => void
  }
  readonly dashboard?: ReactNode
  /** Atualizações (tela 20): o dashboard com o filtro de atualizações. Fica sob o item Dashboard. */
  readonly updates?: ReactNode
  /**
   * Faixa do guia "Primeiros passos", no topo da tela (ADR-10, 3.8.1). Fica acima da tela atual e
   * reinicia a cada troca de tela, porque o conteúdo é recriado por tela.
   */
  readonly guide?: ReactNode
  readonly agenda?: ReactNode
  /** Tela "Configurações" do projeto selecionado (Módulos, Membros, DoD e Geral). */
  readonly modules?: ReactNode
  readonly backlog?: ReactNode
  /** Entregas (EAP). O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly wbs?: ReactNode
  /** Plano do projeto híbrido (tela 17). O item da barra só aparece com a EAP e as sprints ligadas. */
  readonly plan?: ReactNode
  /** Sprint dentro da entrega (tela 18), aberta pelo plano. */
  readonly planSprint?: ReactNode
  /** Marcos do projeto. O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly milestones?: ReactNode
  /** Início do projeto (protótipo projeto-home). O item da barra só aparece com projeto selecionado. */
  readonly home?: ReactNode
  /** Cronograma do projeto. O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly schedule?: ReactNode
  /** Acompanhamento do projeto. O item da barra só aparece com projeto selecionado e o módulo do cronograma ligado. */
  readonly tracking?: ReactNode
  /** Linha de base do projeto. O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly baseline?: ReactNode
  /** Burndown e velocidade. O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly burndown?: ReactNode
  /** Métricas de fluxo do projeto. O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly flowMetrics?: ReactNode
  /** Riscos do projeto. O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly risks?: ReactNode
  readonly sprints?: ReactNode
  readonly impediments?: ReactNode
  readonly children?: ReactNode
  /** Escopo do quadro: "Minhas tarefas" ou "Equipe". Só aparece com o quadro aberto. */
  readonly taskScope?: TaskScope
  readonly onTaskScopeChange?: (scope: TaskScope) => void
}

const viewTitles: Record<PanelView, string> = {
  home: 'Início',
  dashboard: panelCopy.dashboard,
  updates: 'Atualizações',
  projects: 'Quadro',
  backlog: panelCopy.backlogTitle,
  wbs: 'Entregas (EAP)',
  plan: planCopy.title,
  planSprint: sprintCopy.title,
  milestones: 'Marcos',
  schedule: 'Cronograma',
  tracking: trackingCopy.title,
  baseline: baselineCopy.title,
  burndown: burndownCopy.title,
  flowMetrics: flowMetricsCopy.title,
  risks: 'Riscos',
  sprints: sprintCopy.title,
  impediments: impedimentCopy.title,
  agenda: panelCopy.agenda,
  modules: 'Configurações',
  plugins: panelCopy.plugins,
  settings: panelCopy.settings,
}

interface TopNavEntry {
  readonly id: PanelView
  readonly label: string
  readonly icon: string
}

export function PanelShell({
  view,
  managerContext,
  isManager,
  onViewChange,
  canGoBack = false,
  onBack,
  onMinimize,
  onToggleExpand,
  onClose,
  onNewTask,
  newTaskBlockedReason,
  account,
  projects = [],
  selectedProjectId = null,
  onProjectSelect,
  onNewProject,
  showArchivedProjects = false,
  onShowArchivedProjectsChange,
  activeSprintNumber = null,
  projectModuleCount = null,
  onOpenTray,
  onSearch,
  dashboard,
  updates,
  guide,
  agenda,
  modules,
  backlog,
  wbs,
  plan,
  planSprint,
  milestones,
  home,
  schedule,
  tracking,
  baseline,
  burndown,
  flowMetrics,
  risks,
  sprints,
  impediments,
  children,
  taskScope = 'mine',
  onTaskScopeChange,
}: PanelShellProps) {
  const [railExpanded, setRailExpanded] = useState(true)
  const capabilities = useCapabilities()
  const visibleView: PanelView =
    (view === 'dashboard' || view === 'updates') && !isManager ? 'projects' : view
  const hasProject = selectedProjectId !== null
  const selectedProject = projects.find((project) => project.id === selectedProjectId)

  const topEntries: readonly TopNavEntry[] = [
    ...(isManager
      ? [{ id: 'dashboard' as const, label: panelCopy.dashboard, icon: 'dashboard' }]
      : []),
    ...(capabilities.showScreen('agenda')
      ? [{ id: 'agenda' as const, label: panelCopy.agenda, icon: 'agenda' }]
      : []),
  ]

  const projectGroups = buildProjectNavGroups(capabilities, {
    hasProject,
    activeSprintNumber,
    projectModuleCount,
  })
  const activeProjectGroup = findActiveProjectNavGroup(projectGroups, visibleView)
  const effectiveSelected = visibleView === 'updates' ? 'dashboard' : visibleView

  const projectContextLabel = selectedProject?.name ?? panelCopy.allProjects
  // Entregas e Cronograma compartilham a casca do Fluxo Preditivo (rail + subtítulo + indicadores).
  const predictiveGroup =
    activeProjectGroup?.predictive === true && visibleView !== 'planSprint'
      ? activeProjectGroup
      : null
  const viewBody =
    visibleView === 'projects' ? (
      children
    ) : visibleView === 'dashboard' && dashboard ? (
      dashboard
    ) : visibleView === 'updates' && updates ? (
      updates
    ) : visibleView === 'backlog' && backlog ? (
      backlog
    ) : visibleView === 'wbs' && wbs ? (
      wbs
    ) : visibleView === 'plan' && plan ? (
      plan
    ) : visibleView === 'planSprint' && planSprint ? (
      planSprint
    ) : visibleView === 'home' && home ? (
      home
    ) : visibleView === 'milestones' && milestones ? (
      milestones
    ) : visibleView === 'schedule' && schedule ? (
      schedule
    ) : visibleView === 'tracking' && tracking ? (
      tracking
    ) : visibleView === 'baseline' && baseline ? (
      baseline
    ) : visibleView === 'burndown' && burndown ? (
      burndown
    ) : visibleView === 'flowMetrics' && flowMetrics ? (
      flowMetrics
    ) : visibleView === 'risks' && risks ? (
      risks
    ) : visibleView === 'sprints' && sprints ? (
      sprints
    ) : visibleView === 'impediments' && impediments ? (
      impediments
    ) : visibleView === 'agenda' && agenda ? (
      agenda
    ) : visibleView === 'modules' && modules ? (
      modules
    ) : visibleView === 'settings' ? (
      <SettingsView />
    ) : visibleView === 'plugins' ? (
      <EmptyState title={panelCopy.comingSoon} />
    ) : (
      <EmptyState title={panelCopy.comingSoon} />
    )

  return (
    <main className={styles.window} aria-label={panelCopy.title}>
      <Rail
        expanded={railExpanded}
        topEntries={topEntries}
        projectGroups={projectGroups}
        activeGroupId={activeProjectGroup?.id ?? null}
        selectedView={effectiveSelected}
        onExpandChange={setRailExpanded}
        onSelect={onViewChange}
        account={account}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectSelect={onProjectSelect}
        onNewProject={onNewProject}
        showArchivedProjects={showArchivedProjects}
        onShowArchivedProjectsChange={onShowArchivedProjectsChange}
        onOpenTray={onOpenTray}
        onSearch={onSearch}
      />
      <section className={styles.main}>
        <TitleBar
          title={viewTitles[visibleView]}
          projectContext={isProjectScopedView(visibleView) ? projectContextLabel : null}
          board={visibleView === 'projects'}
          canGoBack={canGoBack}
          onBack={onBack}
          managerContext={managerContext}
          onMinimize={onMinimize}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
          onNewTask={onNewTask}
          newTaskBlockedReason={newTaskBlockedReason}
          taskScope={taskScope}
          onTaskScopeChange={onTaskScopeChange}
        />
        <div className={styles.content} key={visibleView}>
          {guide}
          {predictiveGroup ? (
            <PredictiveLayout
              ariaLabel={`Seções de ${predictiveGroup.label}`}
              items={predictiveGroup.tabs}
              activeId={visibleView}
              onSelect={onViewChange}
              projectId={selectedProjectId}
            >
              {viewBody}
            </PredictiveLayout>
          ) : (
            <>
              {activeProjectGroup &&
              activeProjectGroup.tabs.length > 1 &&
              visibleView !== 'planSprint' ? (
                <TopicTabs
                  ariaLabel={`Seções de ${activeProjectGroup.label}`}
                  items={activeProjectGroup.tabs}
                  activeId={visibleView}
                  onSelect={onViewChange}
                />
              ) : null}
              {viewBody}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

interface RailProps {
  readonly expanded: boolean
  readonly topEntries: readonly TopNavEntry[]
  readonly projectGroups: readonly ProjectNavGroup[]
  readonly activeGroupId: ProjectNavGroup['id'] | null
  readonly selectedView: PanelView
  readonly onExpandChange: (expanded: boolean) => void
  readonly onSelect: (view: PanelView) => void
  readonly projects: readonly RailProject[]
  readonly selectedProjectId: string | null
  readonly onProjectSelect: PanelShellProps['onProjectSelect']
  readonly onNewProject: PanelShellProps['onNewProject']
  readonly showArchivedProjects: boolean
  readonly onShowArchivedProjectsChange: PanelShellProps['onShowArchivedProjectsChange']
  readonly onSearch: PanelShellProps['onSearch']
  readonly onOpenTray: PanelShellProps['onOpenTray']
  readonly account: PanelShellProps['account']
}

const ALL_PROJECTS_KEY = '__all__'

function Rail({
  expanded,
  topEntries,
  projectGroups,
  activeGroupId,
  selectedView,
  onExpandChange,
  onSelect,
  account,
  projects,
  selectedProjectId,
  onProjectSelect,
  onNewProject,
  showArchivedProjects,
  onShowArchivedProjectsChange,
  onOpenTray,
  onSearch,
}: RailProps) {
  const [collapsedSelectedKey, setCollapsedSelectedKey] = useState<string | null>(null)

  // Ao trocar de projeto, reabre automaticamente o acordeão da árvore recém-selecionada.
  useEffect(() => {
    setCollapsedSelectedKey(null)
  }, [selectedProjectId])

  const railClass = `${styles.rail} ${expanded ? styles.expanded : ''}`
  const allSelected = selectedProjectId === null
  const allExpanded = allSelected && collapsedSelectedKey !== ALL_PROJECTS_KEY

  function toggleSelectedAccordion(key: string) {
    setCollapsedSelectedKey((current) => (current === key ? null : key))
  }

  return (
    <nav className={railClass} aria-label={panelCopy.navigation}>
      <div className={styles.railHeader}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h7v10H4z" />
              <path d="M13 4h7v7h-7z" />
              <path d="M13 14h7v6h-7z" />
            </svg>
          </span>
          <span className={styles.brandName}>AgileBox</span>
        </div>
        <button
          className={styles.expand}
          type="button"
          aria-label={expanded ? panelCopy.collapseRail : panelCopy.expandRail}
          aria-expanded={expanded}
          onClick={() => onExpandChange(!expanded)}
          title={expanded ? panelCopy.collapseRail : panelCopy.expandRail}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>

      <button
        type="button"
        className={styles.search}
        aria-label="Buscar ou criar"
        title="Buscar ou criar · Ctrl K"
        onClick={onSearch}
      >
        <NavIcon kind="search" />
        <span className={styles.railLabel}>Buscar ou criar</span>
        <Kbd className={styles.kbd}>Ctrl K</Kbd>
      </button>

      {topEntries.length > 0 ? (
        <div className={styles.topGroup}>
          <span className={styles.sectionLabel}>Global</span>
          {topEntries.map((entry) => {
            const isSelected = selectedView === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                aria-current={isSelected ? 'page' : undefined}
                aria-label={entry.label}
                data-tip={entry.label}
                title={entry.label}
                className={`${styles.railItem} ${styles.navItem} ${isSelected ? styles.selected : ''}`}
                onClick={() => onSelect(entry.id)}
              >
                <NavIcon kind={entry.icon} />
                <span className={styles.railLabel}>{entry.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className={styles.scroll}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Projetos</span>
          {onNewProject ? (
            <button
              type="button"
              className={styles.sectionAddBtn}
              aria-label={panelCopy.newProject}
              title={panelCopy.newProject}
              data-tip={panelCopy.newProject}
              onClick={onNewProject}
            >
              <NavIcon kind="plus" />
            </button>
          ) : null}
        </div>

        <div className={styles.projectsTree}>
          <div
            className={`${styles.projectGroup} ${allExpanded ? styles.projectGroupOpen : ''} ${allSelected ? styles.projectGroupCurrent : ''}`}
          >
            <button
              type="button"
              className={`${styles.railItem} ${styles.navItem} ${styles.projectToggle} ${allSelected ? styles.projectPressed : ''}`}
              aria-pressed={allSelected}
              aria-expanded={allExpanded}
              title={panelCopy.allProjects}
              data-tip={panelCopy.allProjects}
              onClick={() => {
                if (allSelected) {
                  toggleSelectedAccordion(ALL_PROJECTS_KEY)
                } else {
                  onProjectSelect?.(null)
                }
              }}
            >
              <span className={styles.allProjectsMark} aria-hidden="true" />
              <span className={`${styles.railLabel} ${styles.projectName}`}>
                {panelCopy.allProjects}
              </span>
              <NavIcon kind="chevron" className={styles.projectChevron} />
            </button>
            {allExpanded ? (
              <ProjectSubItems
                groups={projectGroups}
                activeGroupId={activeGroupId}
                onSelect={onSelect}
              />
            ) : null}
          </div>

          {projects.map((project) => {
            const isSelected = selectedProjectId === project.id
            const isExpanded = isSelected && collapsedSelectedKey !== project.id
            const method = methodologyLabel(project.startedFromPreset)
            return (
              <div
                key={project.id}
                className={`${styles.projectGroup} ${isExpanded ? styles.projectGroupOpen : ''} ${isSelected ? styles.projectGroupCurrent : ''}`}
              >
                <button
                  type="button"
                  className={`${styles.railItem} ${styles.navItem} ${styles.projectToggle} ${isSelected ? styles.projectPressed : ''}`}
                  aria-pressed={isSelected}
                  aria-expanded={isExpanded}
                  title={project.name}
                  data-tip={project.name}
                  onClick={() => {
                    if (isSelected) {
                      toggleSelectedAccordion(project.id)
                    } else {
                      onProjectSelect?.(project.id)
                    }
                  }}
                >
                  <ProjectSwatch index={swatchIndexOf(project.id)} name={project.name} />
                  <span className={`${styles.railLabel} ${styles.projectName}`}>
                    {project.name}
                  </span>
                  {project.archivedAt != null ? (
                    <span className={styles.archivedLabel}>{panelCopy.archivedProject}</span>
                  ) : null}
                  {method ? <span className={styles.methodology}>{method}</span> : null}
                  <NavIcon kind="chevron" className={styles.projectChevron} />
                </button>
                {isExpanded ? (
                  <ProjectSubItems
                    groups={projectGroups}
                    activeGroupId={activeGroupId}
                    onSelect={onSelect}
                  />
                ) : null}
              </div>
            )
          })}

          {onShowArchivedProjectsChange ? (
            <button
              type="button"
              className={`${styles.railItem} ${styles.archivedToggle}`}
              aria-label="Mostrar projetos arquivados"
              aria-pressed={showArchivedProjects}
              title="Mostrar projetos arquivados"
              data-tip="Mostrar projetos arquivados"
              onClick={() => onShowArchivedProjectsChange(!showArchivedProjects)}
            >
              <span className={styles.railLabel}>{panelCopy.showArchived}</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.sectionLabel}>Sistema</span>
        <button
          type="button"
          className={`${styles.railItem} ${styles.navItem} ${selectedView === 'settings' ? styles.selected : ''}`}
          aria-label="Ajustes"
          aria-current={selectedView === 'settings' ? 'page' : undefined}
          data-tip="Ajustes"
          title="Ajustes"
          onClick={() => onSelect('settings')}
        >
          <NavIcon kind="settings" />
          <span className={styles.railLabel}>Ajustes</span>
        </button>
        <button
          type="button"
          className={`${styles.railItem} ${styles.navItem}`}
          aria-label={`${panelCopy.plugins}, ${panelCopy.comingSoon}`}
          data-tip={panelCopy.plugins}
          title={panelCopy.plugins}
          disabled
        >
          <NavIcon kind="plugins" />
          <span className={styles.railLabel}>{panelCopy.plugins}</span>
          <span className={styles.soon}>{panelCopy.comingSoon}</span>
        </button>
        {onOpenTray ? (
          <button
            type="button"
            className={`${styles.railItem} ${styles.navItem}`}
            aria-label="Abrir Bandeja"
            data-tip="Abrir Bandeja"
            title="Abrir Bandeja"
            onClick={onOpenTray}
          >
            <NavIcon kind="tray" />
            <span className={styles.railLabel}>Abrir Bandeja</span>
          </button>
        ) : null}
        <AccountMenu
          users={account?.users ?? []}
          currentUserId={account?.currentUserId}
          onSwitch={account?.onSwitch ?? (() => undefined)}
          buttonClassName={`${styles.railItem} ${styles.account}`}
          avatarClassName={styles.avatar}
          labelClassName={styles.railLabel}
        />
      </div>
    </nav>
  )
}

function ProjectSubItems({
  groups,
  activeGroupId,
  onSelect,
}: {
  readonly groups: readonly ProjectNavGroup[]
  readonly activeGroupId: ProjectNavGroup['id'] | null
  readonly onSelect: (view: PanelView) => void
}) {
  return (
    <div className={styles.projectChildren}>
      {groups.map((group) => {
        const selected = activeGroupId === group.id
        return (
          <button
            key={group.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            aria-label={group.label}
            className={`${styles.railItem} ${styles.subItem} ${selected ? styles.selected : ''}`}
            data-tip={group.label}
            title={group.label}
            onClick={() => onSelect(group.defaultView)}
          >
            <NavIcon kind={group.icon} className={styles.subIcon} />
            <span className={styles.railLabel}>{group.label}</span>
            {group.count ? (
              <span className={styles.count} aria-hidden="true">
                {group.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

interface TitleBarProps {
  readonly board: boolean
  readonly projectContext: string | null
  readonly managerContext: ReactNode
  readonly title: string
  readonly canGoBack: boolean
  readonly onBack: (() => void) | undefined
  readonly onMinimize: () => void
  readonly onToggleExpand: () => void
  readonly onClose: () => void
  readonly onNewTask: () => void
  readonly newTaskBlockedReason: string | undefined
  readonly taskScope: TaskScope
  readonly onTaskScopeChange: ((scope: TaskScope) => void) | undefined
}

function TitleBar({
  title,
  projectContext,
  board,
  canGoBack,
  onBack,
  managerContext,
  onMinimize,
  onToggleExpand,
  onClose,
  onNewTask,
  newTaskBlockedReason,
  taskScope,
  onTaskScopeChange,
}: TitleBarProps) {
  return (
    <header className={styles.titleBar}>
      <div className={styles.titleGroup}>
        <button
          type="button"
          className={styles.backButton}
          aria-label="Voltar"
          title="Voltar (Alt + ←)"
          disabled={!canGoBack}
          onClick={onBack}
        >
          <NavIcon kind="back" />
        </button>
        <div className={styles.breadcrumb}>
          {projectContext ? (
            <>
              <span className={styles.breadcrumbProject}>{projectContext}</span>
              <span className={styles.breadcrumbSep} aria-hidden="true">
                ›
              </span>
            </>
          ) : null}
          <h1 className={styles.title}>{title}</h1>
        </div>
        {board && onTaskScopeChange && (
          <SegmentedControl<TaskScope>
            aria-label={panelCopy.taskScope}
            className={styles.segmented ?? ''}
            onChange={onTaskScopeChange}
            options={[
              { value: 'mine', label: 'Minhas' },
              { value: 'team', label: panelCopy.team },
            ]}
            value={taskScope}
          />
        )}
      </div>
      <div className={styles.titleActions}>
        {board && managerContext}
        {board && (
          <button
            className={styles.newTask}
            aria-label={panelCopy.newTask}
            aria-keyshortcuts="N"
            disabled={newTaskBlockedReason !== undefined}
            title={newTaskBlockedReason}
            onClick={onNewTask}
            type="button"
          >
            <span aria-hidden="true">＋</span> {panelCopy.newTask} <Kbd>N</Kbd>
          </button>
        )}
        <WindowControls
          expanded
          onClose={onClose}
          onMinimize={onMinimize}
          onToggleExpand={onToggleExpand}
        />
      </div>
    </header>
  )
}

function NavIcon({
  kind,
  className,
}: {
  readonly kind: string
  readonly className?: string | undefined
}) {
  const paths: Record<string, string> = {
    search: 'M21 21l-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
    home: 'M3 13l3-8h12l3 8v7H3v-7Z M3 13h5l1 2h6l1-2h5',
    tray: 'M4 4h16v16H4z M4 14h5l1.5 2h3L15 14h5',
    projects: 'M3 4h5v16H3ZM10 4h5v11h-5ZM17 4h4v8h-4Z',
    dashboard: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
    agenda: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
    backlog: 'M4 6h10M4 12h10M4 18h6M16 16l3 3 3-3M19 19V9',
    sprints: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2',
    impediments: 'M12 3 2 20h20L12 3ZM12 10v4m0 3h.01',
    plugins: 'M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4',
    settings:
      'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    plus: 'M12 5v14M5 12h14',
    modules: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    milestones: 'M12 3l8 9-8 9-8-9z',
    schedule: 'M4 6h9M9 12h11M4 18h6M13 6v12',
    tracking: 'M4 19h16M7 15l4-4 3 3 5-6',
    baseline: 'M4 20h16M6 16V10M12 16V6M18 16v-4',
    burndown: 'M4 5v14h16M7 9c3 6 6 8 12 8',
    flowMetrics: 'M6 19v-6M12 19V8M18 19V4',
    risks: 'M4 4h12l4 4v12H4Z M8 12h8M8 16h5',
    wbs: 'M4 6h16M4 12h10M4 18h7',
    plan: 'M4 5h16v4H4zM7 11h10v4H7zM10 17h10v3H10z',
    back: 'M19 12H5M12 19l-7-7 7-7',
    chevron: 'M9 6l6 6-6 6',
  }
  const size = kind === 'chevron' ? '12' : kind === 'back' || kind === 'plus' ? '15' : '16'
  return (
    <span aria-hidden="true" className={className}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={kind === 'chevron' || kind === 'back' ? '2.1' : '1.8'}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={paths[kind] ?? paths.projects} />
      </svg>
    </span>
  )
}
