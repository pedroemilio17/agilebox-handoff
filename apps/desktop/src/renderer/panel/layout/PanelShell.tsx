import { useState, type ReactNode } from 'react'
import { EmptyState, WindowControls } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './PanelShell.module.css'

export type PanelView = 'dashboard' | 'projects' | 'agenda' | 'plugins' | 'settings'

export interface PanelShellProps {
  readonly view: PanelView
  readonly isManager: boolean
  readonly onViewChange: (view: PanelView) => void
  readonly onMinimize: () => void
  readonly onToggleExpand: () => void
  readonly onClose: () => void
  readonly onNewTask: () => void
  readonly children?: ReactNode
}

const viewTitles: Record<PanelView, string> = {
  dashboard: panelCopy.dashboard,
  projects: panelCopy.projects,
  agenda: panelCopy.agenda,
  plugins: panelCopy.plugins,
  settings: panelCopy.settings,
}

export function PanelShell({
  view,
  isManager,
  onViewChange,
  onMinimize,
  onToggleExpand,
  onClose,
  onNewTask,
  children,
}: PanelShellProps) {
  const [railExpanded, setRailExpanded] = useState(false)
  const visibleView = view === 'dashboard' && !isManager ? 'projects' : view
  const items: readonly { id: PanelView; label: string; icon: string; soon?: boolean }[] = [
    ...(isManager ? [{ id: 'dashboard' as const, label: panelCopy.dashboard, icon: '▥' }] : []),
    { id: 'projects', label: panelCopy.projects, icon: '▦' },
    { id: 'agenda', label: panelCopy.agenda, icon: '▣' },
    { id: 'plugins', label: panelCopy.plugins, icon: '⌘', soon: true },
    { id: 'settings', label: panelCopy.settings, icon: '⚙' },
  ]

  return (
    <main className={styles.window} aria-label={panelCopy.title}>
      <Rail
        expanded={railExpanded}
        items={items}
        selected={visibleView}
        onExpandChange={setRailExpanded}
        onSelect={onViewChange}
      />
      <section className={styles.main}>
        <TitleBar
          title={viewTitles[visibleView]}
          onMinimize={onMinimize}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
          onNewTask={onNewTask}
        />
        <div className={styles.content} key={visibleView}>
          {visibleView === 'projects' ? (
            children
          ) : visibleView === 'settings' ? (
            <EmptyState title={panelCopy.comingSoon} />
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
}

function Rail({ expanded, items, selected, onExpandChange, onSelect }: RailProps) {
  return (
    <nav
      className={`${styles.rail} ${expanded ? styles.expanded : ''}`}
      aria-label={panelCopy.navigation}
    >
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
      {items.map((item) => (
        <button
          aria-current={selected === item.id ? 'page' : undefined}
          aria-label={item.soon ? `${item.label}, ${panelCopy.comingSoon}` : item.label}
          className={`${styles.railItem} ${selected === item.id ? styles.selected : ''}`}
          data-tip={item.label}
          key={item.id}
          onClick={() => onSelect(item.id)}
          title={expanded ? undefined : item.label}
          type="button"
        >
          <span aria-hidden="true">{item.icon}</span>
          <span className={styles.railLabel}>{item.label}</span>
          {item.soon ? <span className={styles.soon}>{panelCopy.comingSoon}</span> : null}
        </button>
      ))}
      <span className={styles.spacer} />
      <div className={styles.divider} />
      <button
        className={`${styles.railItem} ${styles.account}`}
        type="button"
        aria-label={panelCopy.account}
      >
        <span className={styles.avatar} aria-hidden="true">
          AG
        </span>
        <span className={styles.railLabel}>{panelCopy.account}</span>
      </button>
    </nav>
  )
}

interface TitleBarProps {
  readonly title: string
  readonly onMinimize: () => void
  readonly onToggleExpand: () => void
  readonly onClose: () => void
  readonly onNewTask: () => void
}

function TitleBar({ title, onMinimize, onToggleExpand, onClose, onNewTask }: TitleBarProps) {
  return (
    <header className={styles.titleBar}>
      <div className={styles.titleGroup}>
        <h1>{title}</h1>
        <div className={styles.segmented} aria-label={panelCopy.taskScope}>
          <button type="button" aria-pressed="true">
            {panelCopy.myTasks}
          </button>
          <button type="button" aria-pressed="false" title={panelCopy.readOnly}>
            {panelCopy.team}
          </button>
          <span>{panelCopy.readOnly}</span>
        </div>
      </div>
      <div className={styles.titleActions}>
        <button className={styles.newTask} onClick={onNewTask} type="button">
          <span aria-hidden="true">＋</span> {panelCopy.newTask}
        </button>
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
