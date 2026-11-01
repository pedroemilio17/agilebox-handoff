import type { HTMLAttributes } from 'react'
import styles from './Skeleton.module.css'

export type SkeletonProps = HTMLAttributes<HTMLSpanElement>

export function Skeleton({
  className,
  'aria-label': ariaLabel = 'Carregando',
  ...props
}: SkeletonProps) {
  const classes = [styles.skeleton, className].filter(Boolean).join(' ')

  return (
    <span {...props} className={classes} role="status" aria-label={ariaLabel} aria-busy="true" />
  )
}
