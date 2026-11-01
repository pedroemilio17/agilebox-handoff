import { useEffect, useRef, useState } from 'react'
import type { SessionUserDto } from '@agilebox/contract'
import { panelCopy } from '../copy'
import styles from './AccountMenu.module.css'

export interface AccountMenuProps {
  readonly users: readonly SessionUserDto[]
  readonly currentUserId: string | undefined
  readonly onSwitch: (userId: string) => void
  readonly buttonClassName: string
  readonly avatarClassName: string | undefined
  readonly labelClassName: string | undefined
}

export function AccountMenu({
  users,
  currentUserId,
  onSwitch,
  buttonClassName,
  avatarClassName,
  labelClassName,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = users.find((user) => user.id === currentUserId)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        className={buttonClassName}
        type="button"
        aria-label={panelCopy.account}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={avatarClassName} aria-hidden="true">
          {current?.initials ?? 'AG'}
        </span>
        <span className={labelClassName}>{current?.name ?? panelCopy.account}</span>
      </button>
      {open ? (
        <div className={styles.menu} role="menu" aria-label={panelCopy.accountMenu}>
          <p className={styles.hint}>{panelCopy.accountMenuHint}</p>
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              role="menuitemradio"
              aria-checked={user.id === currentUserId}
              className={styles.item}
              onClick={() => {
                setOpen(false)
                if (user.id !== currentUserId) onSwitch(user.id)
              }}
            >
              <span className={styles.initials} aria-hidden="true">
                {user.initials}
              </span>
              <span className={styles.name}>{user.name}</span>
              <span className={styles.role}>
                {user.role === 'manager' ? panelCopy.roleManager : panelCopy.roleCollaborator}
              </span>
              <span aria-hidden="true">{user.id === currentUserId ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
