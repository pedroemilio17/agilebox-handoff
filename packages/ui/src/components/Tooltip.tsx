import { useState, type ReactNode } from 'react'
import styles from './Tooltip.module.css'

export interface TooltipProps {
  readonly content: string
  readonly visible?: boolean
  readonly placement?: 'right' | 'top' | 'bottom'
  readonly openOnHover?: boolean
  readonly children: ReactNode
}

export function Tooltip({
  content,
  visible = false,
  placement = 'right',
  openOnHover = false,
  children,
}: TooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const isVisible = visible || (openOnHover && (hovered || focused))

  return (
    <span
      className={styles.anchor}
      onMouseEnter={openOnHover ? () => setHovered(true) : undefined}
      onMouseLeave={openOnHover ? () => setHovered(false) : undefined}
      onFocus={openOnHover ? () => setFocused(true) : undefined}
      onBlur={openOnHover ? () => setFocused(false) : undefined}
    >
      {children}
      {isVisible ? (
        <span className={`${styles.tooltip} ${styles[placement]}`} role="tooltip">
          {content}
        </span>
      ) : null}
    </span>
  )
}
