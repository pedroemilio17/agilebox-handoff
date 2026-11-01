import type { HTMLAttributes } from 'react'
import styles from './GlassSurface.module.css'

export type GlassSurfaceVariant = 'window' | 'group' | 'control' | 'popover'

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant: GlassSurfaceVariant
}

export function GlassSurface({ variant, className, ...props }: GlassSurfaceProps) {
  const classes = [styles.surface, styles[variant], className].filter(Boolean).join(' ')

  return <div {...props} className={classes} data-variant={variant} />
}
