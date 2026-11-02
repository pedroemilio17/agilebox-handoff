import { IconButton } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './ManagerBanner.module.css'

export interface ManagerBannerProps {
  readonly userName: string
  readonly onBack: () => void
}

export function ManagerBanner({ userName, onBack }: ManagerBannerProps) {
  return (
    <div className={styles.banner} role="status" aria-label={`Tarefas de ${userName}`}>
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      <span>Edições aparecem como gestor</span>
      <IconButton
        type="button"
        aria-label={panelCopy.backToMine}
        title={panelCopy.backToMine}
        onClick={onBack}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m10 5-7 7 7 7M3 12h18" />
        </svg>
      </IconButton>
    </div>
  )
}
