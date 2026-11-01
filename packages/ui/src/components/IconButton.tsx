import type { ButtonHTMLAttributes } from 'react'
import styles from './IconButton.module.css'

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  readonly 'aria-label': string
}

export function IconButton({ className, ...props }: IconButtonProps) {
  const classes = [styles.button, className].filter(Boolean).join(' ')

  return <button {...props} className={classes} />
}
