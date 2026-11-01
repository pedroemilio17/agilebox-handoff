import styles from './ProjectTitle.module.css'

export interface ProjectTitleProps {
  readonly projectName: string
  readonly expanded: boolean
  readonly onClick: () => void
}

export function ProjectTitle({ projectName, expanded, onClick }: ProjectTitleProps) {
  return (
    <h2 className={styles.heading}>
      <button
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-label={`Projeto atual: ${projectName}. Trocar de projeto`}
        className={styles.title}
        onClick={onClick}
        type="button"
      >
        <span>{projectName}</span>
        <span aria-hidden="true" className={`${styles.arrow} ${expanded ? styles.rotated : ''}`}>
          ⌄
        </span>
      </button>
    </h2>
  )
}
