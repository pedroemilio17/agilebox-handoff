import type { HTMLAttributes, ReactNode } from 'react'
import styles from './GroupedList.module.css'

export interface GroupedListProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode
}

export function GroupedList({ className, children, ...props }: GroupedListProps) {
  const classes = [styles.list, className].filter(Boolean).join(' ')

  return (
    <div {...props} className={classes} role={props.role ?? 'group'}>
      {children}
    </div>
  )
}

export interface FieldRowProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: string
  readonly children: ReactNode
}

export function FieldRow({ label, className, children, ...props }: FieldRowProps) {
  const classes = [styles.row, className].filter(Boolean).join(' ')

  return (
    <div
      {...props}
      className={classes}
      role={props.role ?? 'group'}
      aria-label={props['aria-label'] ?? label}
    >
      <span className={styles.label}>{label}</span>
      <div className={styles.control}>{children}</div>
    </div>
  )
}
