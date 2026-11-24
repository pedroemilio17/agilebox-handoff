import type { ButtonHTMLAttributes } from 'react'
import styles from './IconButton.module.css'

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  readonly 'aria-label': string
  readonly size?: 'md' | 'sm'
}

export function IconButton({ className, size = 'md', ...props }: IconButtonProps) {
  const classes = [styles.button, size === 'sm' ? styles.sm : null, className]
    .filter(Boolean)
    .join(' ')

  return <button {...props} className={classes} />
}
