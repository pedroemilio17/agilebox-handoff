import type { ReactNode } from 'react'
import { ReadOnlyBadge } from './ReadOnlyBadge'
import styles from './ScopeBanner.module.css'

export interface ScopeBannerProps {
  /** Nome da visão exibida, por exemplo "Visão da equipe". */
  readonly children: ReactNode
}

/** Faixa discreta no topo de uma visão que só permite leitura: nome da visão, "·" e o selo. */
export function ScopeBanner({ children }: ScopeBannerProps) {
  return (
    <div className={styles.banner}>
      <span className={styles.label}>{children}</span>
      <span className={styles.separator} aria-hidden="true">
        ·
      </span>
      <ReadOnlyBadge />
    </div>
  )
}
