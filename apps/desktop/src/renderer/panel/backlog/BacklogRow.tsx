import type { KeyboardEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { Avatar, GlassMenu, ProjectSwatch, useReducedMotion } from '@agilebox/ui'
import type { TaskDto } from '@agilebox/contract'
import { backlogCopy } from './copy'
import { criteriaLabel, formatHours } from './backlog-moves'
import styles from './Backlog.module.css'

export interface BacklogRowProps {
  readonly task: TaskDto
  /** Posição global, 0-based (a ordem do time, não a da lista filtrada). */
  readonly index: number
  readonly total: number
  readonly projectIndex: number
  readonly canReorder: boolean
  readonly responsibleName: string | undefined
  readonly menuOpen: boolean
  readonly taking: boolean
  readonly onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void
  readonly onToggleMenu: () => void
  readonly onCloseMenu: () => void
  readonly onMenuSelect: (id: 'top' | 'end') => void
  readonly onTakeToBoard: () => void
}

function GripIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

/** Uma linha do backlog. Só o gestor vê a alça e o menu; o participante vê um cadeado. */
export function BacklogRow({
  task,
  index,
  total,
  projectIndex,
  canReorder,
  responsibleName,
  menuOpen,
  taking,
  onKeyDown,
  onToggleMenu,
  onCloseMenu,
  onMenuSelect,
  onTakeToBoard,
}: BacklogRowProps) {
  const reduced = useReducedMotion()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: task.id, disabled: !canReorder })

  const menuItems = [
    { id: 'top', label: backlogCopy.moveTop, disabled: index === 0 },
    { id: 'end', label: backlogCopy.moveEnd, disabled: index === total - 1 },
  ]

  const classes = [
    styles.row,
    isDragging ? styles.rowDragging : '',
    isOver && !isDragging ? styles.rowOver : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      aria-label={task.title}
      className={classes}
      onKeyDown={onKeyDown}
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: reduced ? undefined : transition,
      }}
    >
      {canReorder ? (
        <button
          {...attributes}
          {...listeners}
          aria-label={backlogCopy.reorderHandle(task.title)}
          aria-roledescription={backlogCopy.reorderRoleDescription}
          className={styles.grip}
          data-grip-for={task.id}
          ref={setActivatorNodeRef}
          title={backlogCopy.dragHint}
          type="button"
        >
          <GripIcon />
        </button>
      ) : (
        <span
          className={styles.lock}
          role="img"
          aria-label={backlogCopy.lockedHandle}
          title={backlogCopy.lockedHandle}
        >
          <LockIcon />
        </span>
      )}
      <span className={styles.position}>{index + 1}</span>
      <span className={styles.title}>{task.title}</span>
      <span className={styles.project}>
        <ProjectSwatch index={projectIndex} name={task.projectName} />
        {task.projectName}
      </span>
      <span className={task.acceptance?.total === 0 ? styles.muted : styles.criteria}>
        {criteriaLabel(task.acceptance)}
      </span>
      <span className={styles.estimate}>
        {task.estimatedHours === null ? backlogCopy.emptyValue : formatHours(task.estimatedHours)}
      </span>
      {responsibleName ? (
        <Avatar name={responsibleName} className={styles.avatar} />
      ) : (
        <span className={styles.muted}>{backlogCopy.noResponsible}</span>
      )}
      <button
        aria-label={backlogCopy.takeToBoardFor(task.title)}
        className={styles.takeButton}
        data-take-for={task.id}
        disabled={taking}
        onClick={onTakeToBoard}
        type="button"
      >
        {backlogCopy.takeToBoard}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </button>
      {canReorder ? (
        <div className={styles.menuAnchor}>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={backlogCopy.moreActions(task.title)}
            className={styles.more}
            onClick={onToggleMenu}
            type="button"
          >
            ⋯
          </button>
          {menuOpen ? (
            <GlassMenu
              className={styles.menu ?? ''}
              items={menuItems}
              label={backlogCopy.moreActions(task.title)}
              onClose={onCloseMenu}
              onSelect={(id) => onMenuSelect(id as 'top' | 'end')}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
