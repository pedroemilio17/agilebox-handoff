import type { HTMLAttributes } from 'react'
import styles from './ReadOnlyBadge.module.css'

export function ReadOnlyBadge(props: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} className={[styles.badge, props.className].filter(Boolean).join(' ')}>
      Somente leitura
    </span>
  )
}
