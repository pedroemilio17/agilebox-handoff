import type { ReactNode } from 'react'
import styles from './TaskDetailView.module.css'

/** Linha chave-valor limpa (.kv-row do protótipo). */
export function PropertyRow({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <div className={styles.kvRow} role="group" aria-label={label}>
      <span className={styles.kvLabel}>{label}</span>
      <div className={styles.kvValue}>{children}</div>
    </div>
  )
}
