import { Button } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './ManagerBanner.module.css'

export interface ManagerBannerProps {
  readonly userName: string
  readonly onBack: () => void
}

export function ManagerBanner({ userName, onBack }: ManagerBannerProps) {
  return (
    <div className={styles.banner} role="status">
      <span>{panelCopy.managerBanner(userName)}</span>
      <Button type="button" onClick={onBack}>
        {panelCopy.backToMine}
      </Button>
    </div>
  )
}
