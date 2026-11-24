import type { ButtonHTMLAttributes, Ref } from 'react'
import styles from './Button.module.css'
import { Kbd } from './Indicators'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly shortcut?: string
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  readonly size?: 'md' | 'sm'
  /** React 19: `ref` chega como prop comum e vai para o botão. */
  readonly ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  shortcut,
  children,
  className,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], size === 'sm' ? styles.sm : null, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button {...props} className={classes}>
      {children}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  )
}
