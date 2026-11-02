import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Indicators.module.css'

export function Kbd(props: HTMLAttributes<HTMLElement>) {
  return <kbd {...props} className={[styles.kbd, props.className].filter(Boolean).join(' ')} />
}

export function Eyebrow(props: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={[styles.eyebrow, props.className].filter(Boolean).join(' ')} />
}

export interface SignalBadgeProps {
  readonly variant: 'blocked' | 'aging' | 'overdue' | 'wip'
  readonly children: ReactNode
}

export function SignalBadge({ variant, children }: SignalBadgeProps) {
  const danger = variant === 'blocked' || variant === 'overdue'
  return (
    <span className={`${styles.signal} ${danger ? styles.danger : styles.warning}`}>
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M8 2 15 14H1L8 2Z" strokeLinejoin="round" />
        <path d="M8 6v4m0 1.5v1" />
      </svg>
      {children}
    </span>
  )
}

export function ProjectSwatch({ index, name }: { readonly index: number; readonly name: string }) {
  const color = (((Math.trunc(index) % 5) + 5) % 5) + 1
  return (
    <span
      className={styles.swatch}
      role="img"
      aria-label={name}
      style={{ background: `var(--color-project-${color})` }}
    />
  )
}

export interface MetricTileProps {
  readonly label: string
  readonly value: number | null
  readonly caption: string
  readonly onClick: () => void
  readonly signal?: 'danger' | 'warning'
}

export function MetricTile({
  label,
  value,
  caption,
  onClick,
  signal = 'warning',
}: MetricTileProps) {
  return (
    <button type="button" className={styles.metric} onClick={onClick}>
      <span className={styles.metricLabel}>
        <span
          aria-hidden="true"
          className={`${styles.dot} ${value ? styles[signal] : styles.neutral}`}
        />
        {label}
      </span>
      <strong className={`${styles.value} ${value === 0 || value === null ? styles.neutral : ''}`}>
        {value ?? '—'}
        {value === 0 && <span aria-label="Sem ocorrências"> ✓</span>}
      </strong>
      <span className={styles.caption}>{caption}</span>
    </button>
  )
}

export function WipMeter({
  count,
  capacity,
}: {
  readonly count: number
  readonly capacity: number
}) {
  const filled = Math.max(0, Math.trunc(count))
  const slots = Math.max(0, Math.trunc(capacity))
  return (
    <span
      className={styles.wip}
      role="img"
      aria-label={`${filled} em andamento, capacidade de ${slots}`}
    >
      {Array.from({ length: Math.max(filled, slots) }, (_, index) => (
        <span
          key={index}
          className={`${styles.slot} ${index < filled ? styles.filled : ''} ${index >= slots ? styles.excess : ''}`}
        />
      ))}
    </span>
  )
}
