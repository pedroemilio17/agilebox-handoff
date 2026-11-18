import { useState, type ReactNode } from 'react'
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
import styles from './PanelShell.module.css'

export type PanelView =
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
  readonly projects?: readonly RailProject[]
  readonly selectedProjectId?: string | null
  readonly onProjectSelect?: (id: string | null) => void
  /** "Novo projeto" na barra: abre a mesma criação do seletor de projeto. */
  readonly onNewProject?: () => void
  /** Número da sprint ativa do projeto selecionado (ex.: "S4" no subitem Sprints). */
  readonly activeSprintNumber?: number | null
  /** Quantos módulos estão ligados no projeto selecionado (contagem do subitem Módulos). */
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
  /** Tela "Módulos" do projeto selecionado. O item da barra só aparece com projeto selecionado. */
  readonly modules?: ReactNode
  readonly backlog?: ReactNode
  /** Entregas (EAP). O item da barra só aparece com projeto selecionado e o módulo ligado. */
  readonly wbs?: ReactNode
  /** Plano do projeto híbrido (tela 17). O item da barra só aparece com a EAP e as sprints ligadas. */
  readonly plan?: ReactNode
  /** Sprint dentro da entrega (tela 18), aberta pelo plano. Destaca "Quadro" na barra, como no design. */
  readonly planSprint?: ReactNode
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
  modules: 'Módulos',
  plugins: panelCopy.plugins,
  settings: panelCopy.settings,
}

/** Item da barra: tela, rótulo, ícone (só aparece recolhida), contagem à direita e "em breve". */
interface RailEntry {
  readonly id: PanelView
  readonly label: string
  readonly icon: string
  readonly count?: string | null
  readonly soon?: boolean
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
  onProjectSelect,
  onNewProject,
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
  const visibleView = (view === 'dashboard' || view === 'updates') && !isManager ? 'projects' : view
  const hasProject = selectedProjectId !== null
  // Início, Agenda e Dashboard ficam no topo, como no design. Agenda só com o módulo ligado.
  const topEntries: readonly RailEntry[] = [
    ...(capabilities.showScreen('agenda')
      ? [{ id: 'agenda' as const, label: panelCopy.agenda, icon: '▣' }]
      : []),
    ...(isManager ? [{ id: 'dashboard' as const, label: panelCopy.dashboard, icon: '▥' }] : []),
  ]
  // Subitens da seção do projeto, na ordem do design (Quadro, Backlog, Sprints, Burndown, Módulos).
  // Os de módulo seguem o mesmo gate de antes; sem projeto selecionado, só os da organização.
  // Backlog e Sprints são da organização quando não há projeto: a tela continua alcançável.
  // Plano (híbrido): com projeto selecionado e a EAP e as sprints ligadas. Vem antes do Quadro, como no design.
  const planVisible =
    hasProject && capabilities.showScreen('wbs') && capabilities.showScreen('sprints')
  const contextEntries: readonly RailEntry[] = [
    ...(planVisible ? [{ id: 'plan' as const, label: planCopy.title, icon: '◫' }] : []),
    { id: 'projects', label: 'Quadro', icon: '▦' },
    ...(capabilities.showScreen('backlog')
      ? [{ id: 'backlog' as const, label: panelCopy.backlogTitle, icon: '☰' }]
      : []),
    ...(capabilities.showScreen('sprints')
      ? [
          {
            id: 'sprints' as const,
            label: sprintCopy.title,
            icon: '◷',
            count: hasProject && activeSprintNumber !== null ? `S${activeSprintNumber}` : null,
          },
        ]
      : []),
    ...(hasProject && capabilities.showScreen('burndown')
      ? [{ id: 'burndown' as const, label: viewTitles.burndown, icon: '↘' }]
      : []),
    // Entregas (EAP): só com projeto selecionado e o módulo ligado no projeto.
    ...(hasProject && capabilities.showScreen('wbs')
      ? [{ id: 'wbs' as const, label: viewTitles.wbs, icon: '▤' }]
      : []),
    // Marcos: com projeto selecionado e o módulo ligado no projeto (sem EAP, a tela continua).
    ...(hasProject && capabilities.showScreen('milestones')
      ? [{ id: 'milestones' as const, label: viewTitles.milestones, icon: '◇' }]
      : []),
    // Cronograma: com projeto selecionado e o módulo ligado no projeto.
    ...(hasProject && capabilities.showScreen('schedule')
      ? [{ id: 'schedule' as const, label: viewTitles.schedule, icon: '≋' }]
      : []),
    // Acompanhamento: no mesmo módulo do cronograma (só com projeto selecionado).
    ...(hasProject && capabilities.showScreen('schedule')
      ? [{ id: 'tracking' as const, label: viewTitles.tracking, icon: '◔' }]
      : []),
    // Linha de base: módulo `baseline` ligado no projeto selecionado (N3; o nível não esconde a tela).
    ...(hasProject && capabilities.showScreen('baseline')
      ? [{ id: 'baseline' as const, label: viewTitles.baseline, icon: '▥' }]
      : []),
    // Métricas de fluxo: módulo `flowMetrics` ligado no projeto selecionado (N3; o nível não esconde a tela).
    ...(hasProject && capabilities.showScreen('flowMetrics')
      ? [{ id: 'flowMetrics' as const, label: viewTitles.flowMetrics, icon: '▁' }]
      : []),
    // Riscos: módulo `risks` ligado no projeto selecionado (N3; o nível não esconde a tela).
    ...(hasProject && capabilities.showScreen('risks')
      ? [{ id: 'risks' as const, label: viewTitles.risks, icon: '△' }]
      : []),
    // Impedimentos: Intermediário em diante, com o módulo ligado (ou encerrando). Básico não vê a tela.
    ...(capabilities.showScreen('impediments')
      ? [{ id: 'impediments' as const, label: impedimentCopy.title, icon: '⚑' }]
      : []),
    // Módulos: qualquer pessoa vê a lista do projeto selecionado (o colaborador só lê).
    ...(hasProject
      ? [
          {
            id: 'modules' as const,
            label: viewTitles.modules,
            icon: '⚙',
            count: projectModuleCount !== null ? String(projectModuleCount) : null,
          },
        ]
      : []),
    { id: 'plugins', label: panelCopy.plugins, icon: '⌘', soon: true },
  ]

  return (
    <main className={styles.window} aria-label={panelCopy.title}>
      <Rail
        expanded={railExpanded}
        topEntries={topEntries}
        contextEntries={contextEntries}
        selected={
          visibleView === 'planSprint'
            ? 'projects'
            : visibleView === 'updates'
              ? 'dashboard'
              : visibleView
        }
        onExpandChange={setRailExpanded}
        onSelect={onViewChange}
        account={account}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectSelect={onProjectSelect}
        onNewProject={onNewProject}
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
          {guide}
          {visibleView === 'projects' ? (
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
  readonly topEntries: readonly RailEntry[]
  readonly contextEntries: readonly RailEntry[]
  readonly selected: PanelView
  readonly onExpandChange: (expanded: boolean) => void
  readonly onSelect: (view: PanelView) => void
  readonly projects: readonly RailProject[]
  readonly selectedProjectId: string | null
  readonly onProjectSelect: PanelShellProps['onProjectSelect']
  readonly onNewProject: PanelShellProps['onNewProject']
  readonly onSearch: PanelShellProps['onSearch']
  readonly onOpenTray: PanelShellProps['onOpenTray']
  readonly account: PanelShellProps['account']
}

function Rail({
  expanded,
  topEntries,
  contextEntries,
  selected,
  onExpandChange,
  onSelect,
  account,
  projects,
  selectedProjectId,
  onProjectSelect,
  onNewProject,
  onOpenTray,
  onSearch,
}: RailProps) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const otherProjects = projects.filter((project) => project.id !== selectedProjectId)
  const railClass = `${styles.rail} ${expanded ? styles.expanded : ''}`
  return (
    <nav className={railClass} aria-label={panelCopy.navigation}>
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
      <div className={styles.topGroup}>
        <button
          type="button"
          className={`${styles.railItem} ${styles.navItem}`}
          aria-label="Início"
          title="Início"
          onClick={onOpenTray}
        >
          <NavIcon kind="home" />
          <span className={styles.railLabel}>Início</span>
        </button>
        {topEntries.map((entry) => (
          <RailButton
            key={entry.id}
            entry={entry}
            kind="top"
            selected={selected === entry.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className={styles.scroll}>
        <span className={styles.sectionLabel}>
          {selectedProject ? 'Projeto' : panelCopy.allProjects}
        </span>
        {selectedProject ? (
          <ProjectRow
            project={selectedProject}
            pressed
            // Clicar no projeto já selecionado leva ao quadro dele.
            onSelect={() => onSelect('projects')}
          />
        ) : null}
        <div className={styles.subGroup}>
          {contextEntries.map((entry) => (
            <RailButton
              key={entry.id}
              entry={entry}
              kind="sub"
              selected={selected === entry.id}
              onSelect={onSelect}
            />
          ))}
        </div>
        <span className={styles.sectionLabel}>
          {selectedProject ? 'Outros projetos' : 'Projetos'}
        </span>
        {selectedProject ? (
          <button
            type="button"
            className={`${styles.railItem} ${styles.navItem} ${styles.allProjects}`}
            aria-pressed="false"
            onClick={() => onProjectSelect?.(null)}
          >
            <span className={styles.allProjectsMark} aria-hidden="true" />
            <span className={styles.railLabel}>{panelCopy.allProjects}</span>
          </button>
        ) : null}
        {(selectedProject ? otherProjects : projects).map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            pressed={false}
            onSelect={() => onProjectSelect?.(project.id)}
          />
        ))}
        {onNewProject ? (
          <button
            type="button"
            className={`${styles.railItem} ${styles.navItem} ${styles.newProject}`}
            onClick={onNewProject}
          >
            <NavIcon kind="plus" />
            <span className={styles.railLabel}>Novo projeto</span>
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className={`${styles.railItem} ${styles.navItem} ${selected === 'settings' ? styles.selected : ''}`}
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

/** Linha de projeto: quadradinho, nome e, à direita, o rótulo da metodologia (ou "Arquivado"). */
function ProjectRow({
  project,
  pressed,
  onSelect,
}: {
  readonly project: RailProject
  readonly pressed: boolean
  readonly onSelect: () => void
}) {
  const method = methodologyLabel(project.startedFromPreset)
  return (
    <button
      type="button"
      className={`${styles.railItem} ${styles.navItem} ${styles.projectRow} ${pressed ? styles.projectPressed : ''}`}
      aria-pressed={pressed}
      title={project.name}
      onClick={onSelect}
    >
      <ProjectSwatch index={swatchIndexOf(project.id)} name={project.name} />
      <span className={`${styles.railLabel} ${styles.projectName}`}>{project.name}</span>
      {project.archivedAt != null ? (
        <span className={styles.archivedLabel}>{panelCopy.archivedProject}</span>
      ) : null}
      {method ? <span className={styles.methodology}>{method}</span> : null}
    </button>
  )
}

/** Item de topo ("nav") ou subitem do projeto ("sub"). Subitem com contagem à direita (fora do nome). */
function RailButton({
  entry,
  kind,
  selected,
  onSelect,
}: {
  readonly entry: RailEntry
  readonly kind: 'top' | 'sub'
  readonly selected: boolean
  readonly onSelect: (view: PanelView) => void
}) {
  const className = [
    styles.railItem,
    kind === 'top' ? styles.navItem : styles.subItem,
    selected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      aria-current={selected ? 'page' : undefined}
      aria-label={entry.soon ? `${entry.label}, ${panelCopy.comingSoon}` : entry.label}
      className={className}
      data-tip={entry.label}
      disabled={entry.soon}
      onClick={() => onSelect(entry.id)}
      title={entry.label}
      type="button"
    >
      <NavIcon kind={entry.id} className={styles.subIcon} />
      <span className={styles.railLabel}>{entry.label}</span>
      {entry.count ? (
        <span className={styles.count} aria-hidden="true">
          {entry.count}
        </span>
      ) : null}
      {entry.soon ? <span className={styles.soon}>{panelCopy.comingSoon}</span> : null}
    </button>
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

function NavIcon({
  kind,
  className,
}: {
  readonly kind: string
  readonly className?: string | undefined
}) {
  // Caminhos dos ícones do design (Modulos.dc.html) para os itens de topo; os demais seguem o app.
  const paths: Record<string, string> = {
    search: 'M21 21l-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
    home: 'M3 13l3-8h12l3 8v7H3v-7Z M3 13h5l1 2h6l1-2h5',
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
  }
  return (
    <span aria-hidden="true" className={className}>
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
