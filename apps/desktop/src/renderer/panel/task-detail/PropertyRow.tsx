import type { ReactNode } from 'react'
import styles from './TaskDetailView.module.css'

export function PropertyRow({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <div className={styles.propertyRow} role="group" aria-label={label}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
