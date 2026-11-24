import { useEffect, useRef, type ReactNode } from 'react'
import { useRestoreFocus } from '../hooks/use-restore-focus'
import styles from './Drawer.module.css'

export interface DrawerProps {
  readonly open: boolean
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly size?: 'default' | 'narrow' | 'wide'
  readonly className?: string
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  size = 'default',
  className,
}: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null)
  useRestoreFocus(open)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  if (!open) return null
  const classes = [
    styles.drawer,
    size === 'narrow' ? styles.narrow : null,
    size === 'wide' ? styles.wide : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className={classes}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      {children}
    </div>
  )
}
