import { useId, type HTMLAttributes, type ReactNode } from 'react'
import styles from './EmptyState.module.css'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  readonly title: string
  readonly description?: string
  readonly action?: ReactNode
}

export function EmptyState({ title, description, action, className, ...props }: EmptyStateProps) {
  const titleId = useId()
  const classes = [styles.emptyState, className].filter(Boolean).join(' ')

  return (
    <div {...props} className={classes} role="status" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}
