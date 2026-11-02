import type { HTMLAttributes } from 'react'
import styles from './ReadOnlyBadge.module.css'

export function ReadOnlyBadge(props: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} className={[styles.badge, props.className].filter(Boolean).join(' ')}>
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      Somente leitura
    </span>
  )
}
