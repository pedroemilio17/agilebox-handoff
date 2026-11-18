import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'
import styles from './AddButton.module.css'

export interface AddButtonProps extends Omit<ButtonProps, 'children'> {
  /** Texto do botão: diz o que será incluído (ex.: "Adicionar subtarefa"). */
  readonly children: ReactNode
}

/**
 * Botão de inclusão: "+" + rótulo em texto. O ícone é decorativo (aria-hidden),
 * então o nome acessível é só o rótulo.
 */
export function AddButton({ children, className, ...props }: AddButtonProps) {
  const classes = [styles.addButton, className].filter(Boolean).join(' ')

  return (
    <Button {...props} className={classes}>
      <svg
        className={styles.icon}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
      {children}
    </Button>
  )
}
