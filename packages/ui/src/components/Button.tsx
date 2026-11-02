import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'
import { Kbd } from './Indicators'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly shortcut?: string
  readonly variant?: 'primary' | 'secondary'
}

export function Button({
  variant = 'secondary',
  shortcut,
  children,
  className,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')

  return (
    <button {...props} className={classes}>
      {children}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  )
}
