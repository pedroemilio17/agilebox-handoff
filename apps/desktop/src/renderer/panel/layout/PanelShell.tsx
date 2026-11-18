import { useState, type ReactNode } from 'react'
import {
  EmptyState,
  WindowControls,
  ProjectSwatch,
  Eyebrow,
  Kbd,
  SegmentedControl,
} from '@agilebox/ui'
import type { SessionUserDto } from '@agilebox/contract'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import type { TaskScope } from '../board/task-scope'
import { panelCopy } from '../copy'
import { AccountMenu } from './AccountMenu'
import { SettingsView } from '../settings/SettingsView'
import { sprintCopy } from '../sprints/sprint-copy'
import { impedimentCopy } from '../impediments/impediment-copy'
import { trackingCopy } from '../tracking/tracking-screen'
import { baselineCopy } from '../baseline/baseline-screen'
import { burndownCopy } from '../burndown/burndown-screen'
import { flowMetricsCopy } from '../flow-metrics/flow-metrics-screen'
import styles from './PanelShell.module.css'

export type PanelView =
  | 'dashboard'
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
  | 'impediments'
  | 'agenda'
  | 'modules'
  | 'plugins'
  | 'settings'

export interface PanelShellProps {
  readonly projectSelector?: ReactNode
  readonly managerContext?: ReactNode
  readonly view: PanelView
  readonly isManager: boolean
  readonly onViewChange: (view: PanelView) => void
  readonly onMinimize: () => void
  readonly onToggleExpand: () => void
  readonly onClose: () => void
  readonly onNewTask: () => void
  /** Motivo para desabilitar "Nova tarefa" (ex.: projeto arquivado selecionado). */
  readonly newTaskBlockedReason?: string | undefined
  readonly projects?: readonly {
    readonly id: string
    readonly name: string
    readonly archivedAt?: string | null | undefined
  }[]
  readonly selectedProjectId?: string | null
  readonly projectCounts?: Readonly<Record<string, number>>
  readonly onProjectSelect?: (id: string | null) => void
  readonly onSearch?: () => void
  readonly onOpenTray?: () => void
  readonly account?: {
    readonly users: readonly SessionUserDto[]
    readonly currentUserId: string | undefined
    readonly onSwitch: (userId: string) => void
  }
  readonly dashboard?: ReactNode
  readonly agenda?: ReactNode
  /** Tela "Módulos" do projeto selecionado. O item da barra só aparece com projeto selecionado. */
  readonly modules?: ReactNode
  readonly backlog?: ReactNode
  /** Entregas (EAP). O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly wbs?: ReactNode
  /** Marcos do projeto. O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly milestones?: ReactNode
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
  dashboard: panelCopy.dashboard,
  projects: 'Quadro',
  backlog: panelCopy.backlogTitle,
  wbs: 'Entregas',
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
  modules: 'Módulos',
  plugins: panelCopy.plugins,
  settings: panelCopy.settings,
}

export function PanelShell({
  view,
  projectSelector,
  managerContext,
  isManager,
  onViewChange,
  onMinimize,
  onToggleExpand,
  onClose,
  onNewTask,
  newTaskBlockedReason,
  account,
  projects = [],
  selectedProjectId = null,
  projectCounts,
  onProjectSelect,
  onOpenTray,
  onSearch,
  dashboard,
  agenda,
  modules,
  backlog,
  wbs,
  milestones,
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
  const visibleView = view === 'dashboard' && !isManager ? 'projects' : view
  const items: readonly { id: PanelView; label: string; icon: string; soon?: boolean }[] = [
    ...(isManager ? [{ id: 'dashboard' as const, label: panelCopy.dashboard, icon: '▥' }] : []),
    { id: 'projects', label: 'Quadro', icon: '▦' },
    // Backlog só com o módulo ligado e o nível da pessoa (Intermediário em diante).
    ...(capabilities.showScreen('backlog')
      ? [{ id: 'backlog' as const, label: panelCopy.backlogTitle, icon: '☰' }]
      : []),
    // Entregas (EAP): só com projeto selecionado e o módulo ligado no projeto.
    ...(selectedProjectId !== null && capabilities.showScreen('wbs')
      ? [{ id: 'wbs' as const, label: viewTitles.wbs, icon: '▤' }]
      : []),
    // Marcos: com projeto selecionado e o módulo ligado no projeto (sem EAP, a tela continua).
    ...(selectedProjectId !== null && capabilities.showScreen('milestones')
      ? [{ id: 'milestones' as const, label: viewTitles.milestones, icon: '◇' }]
      : []),
    // Cronograma: com projeto selecionado e o módulo ligado no projeto.
    ...(selectedProjectId !== null && capabilities.showScreen('schedule')
      ? [{ id: 'schedule' as const, label: viewTitles.schedule, icon: '≋' }]
      : []),
    // Acompanhamento: no mesmo módulo do cronograma (só com projeto selecionado).
    ...(selectedProjectId !== null && capabilities.showScreen('schedule')
      ? [{ id: 'tracking' as const, label: viewTitles.tracking, icon: '◔' }]
      : []),
    // Linha de base: módulo `baseline` ligado no projeto selecionado (N3; o nível não esconde a tela).
    ...(selectedProjectId !== null && capabilities.showScreen('baseline')
      ? [{ id: 'baseline' as const, label: viewTitles.baseline, icon: '▥' }]
      : []),
    // Burndown e velocidade: módulo `burndown` ligado no projeto selecionado.
    ...(selectedProjectId !== null && capabilities.showScreen('burndown')
      ? [{ id: 'burndown' as const, label: viewTitles.burndown, icon: '↘' }]
      : []),
    // Métricas de fluxo: módulo `flowMetrics` ligado no projeto selecionado (N3; o nível não esconde a tela).
    ...(selectedProjectId !== null && capabilities.showScreen('flowMetrics')
      ? [{ id: 'flowMetrics' as const, label: viewTitles.flowMetrics, icon: '▁' }]
      : []),
    // Riscos: módulo `risks` ligado no projeto selecionado (N3; o nível não esconde a tela).
    ...(selectedProjectId !== null && capabilities.showScreen('risks')
      ? [{ id: 'risks' as const, label: viewTitles.risks, icon: '△' }]
      : []),
    // Sprints: Intermediário em diante, com o módulo ligado (ou encerrando). Básico não vê a tela.
    ...(capabilities.showScreen('sprints')
      ? [{ id: 'sprints' as const, label: sprintCopy.title, icon: '◷' }]
      : []),
    // Agenda só com o módulo ligado e o nível da pessoa; sem "em breve" nem item desabilitado.
    // Impedimentos: Intermediário em diante, com o módulo ligado (ou encerrando). Básico não vê a tela.
    ...(capabilities.showScreen('impediments')
      ? [{ id: 'impediments' as const, label: impedimentCopy.title, icon: '⚑' }]
      : []),
    ...(capabilities.showScreen('agenda')
      ? [{ id: 'agenda' as const, label: panelCopy.agenda, icon: '▣' }]
      : []),
    // Módulos: qualquer pessoa vê a lista do projeto selecionado (o colaborador só lê).
    ...(selectedProjectId !== null
      ? [{ id: 'modules' as const, label: viewTitles.modules, icon: '⚙' }]
      : []),
    { id: 'plugins', label: panelCopy.plugins, icon: '⌘', soon: true },
  ]

  return (
    <main className={styles.window} aria-label={panelCopy.title}>
      <Rail
        expanded={railExpanded}
        items={items}
        selected={visibleView}
        onExpandChange={setRailExpanded}
        onSelect={onViewChange}
        account={account}
        projects={projects}
        selectedProjectId={selectedProjectId}
        projectCounts={projectCounts}
        onProjectSelect={onProjectSelect}
        onOpenTray={onOpenTray}
        onSearch={onSearch}
      />
      <section className={styles.main}>
        <TitleBar
          title={viewTitles[visibleView]}
          board={visibleView === 'projects'}
          projectSelector={projectSelector}
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
          {visibleView === 'projects' ? (
            children
          ) : visibleView === 'dashboard' && dashboard ? (
            dashboard
          ) : visibleView === 'backlog' && backlog ? (
            backlog
          ) : visibleView === 'wbs' && wbs ? (
            wbs
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
          )}
        </div>
      </section>
    </main>
  )
}

interface RailProps {
  readonly expanded: boolean
  readonly items: readonly { id: PanelView; label: string; icon: string; soon?: boolean }[]
  readonly selected: PanelView
  readonly onExpandChange: (expanded: boolean) => void
  readonly onSelect: (view: PanelView) => void
  readonly projects: NonNullable<PanelShellProps['projects']>
  readonly selectedProjectId: string | null
  readonly projectCounts: PanelShellProps['projectCounts']
  readonly onProjectSelect: PanelShellProps['onProjectSelect']
  readonly onSearch: PanelShellProps['onSearch']
  readonly onOpenTray: PanelShellProps['onOpenTray']
  readonly account: PanelShellProps['account']
}

function Rail({
  expanded,
  items,
  selected,
  onExpandChange,
  onSelect,
  account,
  projects,
  selectedProjectId,
  projectCounts,
  onProjectSelect,
  onOpenTray,
  onSearch,
}: RailProps) {
  return (
    <nav
      className={`${styles.rail} ${expanded ? styles.expanded : ''}`}
      aria-label={panelCopy.navigation}
    >
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          A
        </span>
        <span className={styles.railLabel}>AgileBox</span>
      </div>
      <button
        className={`${styles.railItem} ${styles.expand}`}
        type="button"
        aria-label={expanded ? panelCopy.collapseRail : panelCopy.expandRail}
        aria-expanded={expanded}
        onClick={() => onExpandChange(!expanded)}
        title={expanded ? panelCopy.collapseRail : panelCopy.expandRail}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <button
        type="button"
        className={styles.railItem}
        aria-label="Início"
        title="Início"
        onClick={onOpenTray}
      >
        <NavIcon kind="home" />
        <span className={styles.railLabel}>Início</span>
      </button>
      <button
        type="button"
        className={styles.railItem}
        aria-label="Buscar ou criar"
        title="Buscar ou criar · Ctrl K"
        onClick={onSearch}
      >
        <NavIcon kind="search" />
        <span className={styles.railLabel}>
          Buscar ou criar <Kbd>Ctrl K</Kbd>
        </span>
      </button>
      {items.map((item) => (
        <button
          aria-current={selected === item.id ? 'page' : undefined}
          aria-label={item.soon ? `${item.label}, ${panelCopy.comingSoon}` : item.label}
          className={`${styles.railItem} ${selected === item.id ? styles.selected : ''}`}
          data-tip={item.label}
          key={item.id}
          disabled={item.soon}
          onClick={() => onSelect(item.id)}
          title={expanded ? undefined : item.label}
          type="button"
        >
          <NavIcon kind={item.id} />
          <span className={styles.railLabel}>{item.label}</span>
          {item.soon ? <span className={styles.soon}>{panelCopy.comingSoon}</span> : null}
        </button>
      ))}
      <div className={styles.projectList}>
        <Eyebrow>Projetos</Eyebrow>
        <button
          type="button"
          className={styles.projectItem}
          aria-pressed={selectedProjectId === null}
          onClick={() => onProjectSelect?.(null)}
        >
          Todos os projetos
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={styles.projectItem}
            aria-pressed={selectedProjectId === project.id}
            onClick={() => onProjectSelect?.(project.id)}
          >
            <ProjectSwatch
              index={Array.from(project.id).reduce((sum, char) => sum + char.charCodeAt(0), 0)}
              name={project.name}
            />
            <span className={styles.projectName}>{project.name}</span>
            {project.archivedAt != null ? (
              <span className={styles.archivedLabel}>{panelCopy.archivedProject}</span>
            ) : null}
            <span className={styles.count}>{projectCounts?.[project.id] ?? '—'}</span>
          </button>
        ))}
      </div>
      <span className={styles.spacer} />
      <button
        type="button"
        className={`${styles.railItem} ${selected === 'settings' ? styles.selected : ''}`}
        aria-label="Ajustes"
        aria-current={selected === 'settings' ? 'page' : undefined}
        onClick={() => onSelect('settings')}
      >
        <NavIcon kind="settings" />
        <span className={styles.railLabel}>Ajustes</span>
      </button>
      <div className={styles.divider} />
      <AccountMenu
        users={account?.users ?? []}
        currentUserId={account?.currentUserId}
        onSwitch={account?.onSwitch ?? (() => undefined)}
        buttonClassName={`${styles.railItem} ${styles.account}`}
        avatarClassName={styles.avatar}
        labelClassName={styles.railLabel}
      />
    </nav>
  )
}

interface TitleBarProps {
  readonly board: boolean
  readonly projectSelector: ReactNode
  readonly managerContext: ReactNode
  readonly title: string
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
  board,
  projectSelector,
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
        <h1>{title}</h1>
        {board && projectSelector}
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

function NavIcon({ kind }: { readonly kind: string }) {
  const paths: Record<string, string> = {
    search: 'M21 21l-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
    home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    projects: 'M3 4h5v16H3ZM10 4h5v11h-5ZM17 4h4v8h-4Z',
    dashboard: 'M4 20V10m8 10V4m8 16v-7',
    agenda: 'M4 5h16v16H4ZM4 10h16M8 2v6m8-6v6',
    backlog: 'M4 6h10M4 12h10M4 18h6M16 16l3 3 3-3M19 19V9',
    sprints: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2',
    impediments: 'M12 3 2 20h20L12 3ZM12 10v4m0 3h.01',
    plugins: 'M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4',
    settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
    modules: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    milestones: 'M12 3l8 9-8 9-8-9z',
    schedule: 'M4 6h9M9 12h11M4 18h6M13 6v12',
    tracking: 'M4 19h16M7 15l4-4 3 3 5-6',
    baseline: 'M4 20h16M6 16V10M12 16V6M18 16v-4',
    burndown: 'M4 5v14h16M7 9c3 6 6 8 12 8',
    flowMetrics: 'M6 19v-6M12 19V8M18 19V4',
    risks: 'M4 4h12l4 4v12H4Z M8 12h8M8 16h5',
  }
  return (
    <span aria-hidden="true">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={paths[kind] ?? paths.projects} />
      </svg>
    </span>
  )
}
