import type { HTMLAttributes } from 'react'
import styles from './Avatar.module.css'

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, ' children'> {
  readonly name: string
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('')
}

export function Avatar({ name, className, ...props }: AvatarProps) {
  const classes = [styles.avatar, className].filter(Boolean).join(' ')

  return (
    <span {...props} className={classes} role="img" aria-label={name}>
      {getInitials(name)}
    </span>
  )
}
