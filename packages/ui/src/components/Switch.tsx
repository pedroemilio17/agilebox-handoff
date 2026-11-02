import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Switch.module.css'

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'role' | 'type' | 'onClick' | 'children'
> {
  readonly checked: boolean
  readonly onCheckedChange: (checked: boolean) => void
  /** Nome visível e acessível do interruptor. */
  readonly children: ReactNode
}

export function Switch({ checked, onCheckedChange, children, className, ...props }: SwitchProps) {
  const classes = [styles.switch, className].filter(Boolean).join(' ')

  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      className={classes}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className={styles.label}>{children}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  )
}
