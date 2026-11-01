import type { ReactNode } from 'react'
import styles from './Tooltip.module.css'

export interface TooltipProps {
  readonly content: string
  readonly visible?: boolean
  readonly children: ReactNode
}

export function Tooltip({ content, visible = false, children }: TooltipProps) {
  return (
    <span className={styles.anchor}>
      {children}
      {visible ? (
        <span className={styles.tooltip} role="tooltip">
          {content}
        </span>
      ) : null}
    </span>
  )
}
