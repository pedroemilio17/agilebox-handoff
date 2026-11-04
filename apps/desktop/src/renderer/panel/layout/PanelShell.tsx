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
import type { TaskScope } from '../board/task-scope'
import { panelCopy } from '../copy'
import { AccountMenu } from './AccountMenu'
import { SettingsView } from '../settings/SettingsView'
import styles from './PanelShell.module.css'

export type PanelView = 'dashboard' | 'projects' | 'agenda' | 'plugins' | 'settings'

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
  readonly projects?: readonly { readonly id: string; readonly name: string }[]
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
  readonly children?: ReactNode
  /** Escopo do quadro: "Minhas tarefas" ou "Equipe". Só aparece com o quadro aberto. */
  readonly taskScope?: TaskScope
  readonly onTaskScopeChange?: (scope: TaskScope) => void
}

const viewTitles: Record<PanelView, string> = {
  dashboard: panelCopy.dashboard,
  projects: 'Quadro',
  agenda: panelCopy.agenda,
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
  account,
  projects = [],
  selectedProjectId = null,
  projectCounts,
  onProjectSelect,
  onOpenTray,
  onSearch,
  dashboard,
  agenda,
  children,
  taskScope = 'mine',
  onTaskScopeChange,
}: PanelShellProps) {
  const [railExpanded, setRailExpanded] = useState(true)
  const visibleView = view === 'dashboard' && !isManager ? 'projects' : view
  const items: readonly { id: PanelView; label: string; icon: string; soon?: boolean }[] = [
    ...(isManager ? [{ id: 'dashboard' as const, label: panelCopy.dashboard, icon: '▥' }] : []),
    { id: 'projects', label: 'Quadro', icon: '▦' },
    { id: 'agenda', label: panelCopy.agenda, icon: '▣' },
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
          taskScope={taskScope}
          onTaskScopeChange={onTaskScopeChange}
        />
        <div className={styles.content} key={visibleView}>
          {visibleView === 'projects' ? (
            children
          ) : visibleView === 'dashboard' && dashboard ? (
            dashboard
          ) : visibleView === 'agenda' && agenda ? (
            agenda
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
    plugins: 'M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4',
    settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
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
