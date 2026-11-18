import type { ButtonHTMLAttributes, Ref } from 'react'
import styles from './Button.module.css'
import { Kbd } from './Indicators'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly shortcut?: string
  readonly variant?: 'primary' | 'secondary'
  /** React 19: `ref` chega como prop comum e vai para o botão. */
  readonly ref?: Ref<HTMLButtonElement>
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
