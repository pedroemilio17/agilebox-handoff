import styles from './ScopeAnnouncement.module.css'

export interface ScopeAnnouncementProps {
  /** Nome da visão recém-escolhida; vazio até a primeira troca, para não anunciar ao abrir. */
  readonly message: string
}

/** Região `aria-live` educada que anuncia a troca entre "Minhas tarefas" e "Visão da equipe". */
export function ScopeAnnouncement({ message }: ScopeAnnouncementProps) {
  return (
    <p aria-live="polite" className={styles.liveRegion}>
      {message}
    </p>
  )
}
