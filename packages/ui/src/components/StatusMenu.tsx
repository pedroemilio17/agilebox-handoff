import { useEffect, useRef } from 'react'
import { TASK_STATUSES } from '@agilebox/core'
import type { TaskStatus } from '@agilebox/core'
import styles from './StatusMenu.module.css'
import { StatusChip } from './StatusChip'

export interface StatusMenuProps {
  readonly value: TaskStatus
  readonly onChange: (status: TaskStatus) => void
  readonly onClose?: () => void
}

export function StatusMenu({ value, onChange, onClose }: StatusMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    return () => returnFocusRef.current?.focus()
  }, [])

  function close(): void {
    onClose?.()
    returnFocusRef.current?.focus()
  }

  return (
    <div
      ref={menuRef}
      className={`${styles.menu} motion-status-menu-enter`}
      role="menu"
      aria-label="Status da tarefa"
      style={{ width: '224px' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
        }
      }}
    >
      {TASK_STATUSES.map((status) => (
        <button
          key={status}
          className={styles.item}
          type="button"
          role="menuitemradio"
          aria-checked={status === value}
          onClick={() => {
            onChange(status)
            close()
          }}
        >
          <StatusChip status={status} />
          <span className={styles.check} aria-hidden="true">
            {status === value ? '✓' : ''}
          </span>
        </button>
      ))}
    </div>
  )
}
