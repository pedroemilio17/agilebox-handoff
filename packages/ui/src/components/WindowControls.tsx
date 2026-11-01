import styles from './WindowControls.module.css'

export interface WindowControlsProps {
  readonly onMinimize: () => void
  readonly onToggleExpand: () => void
  readonly onClose: () => void
  readonly expanded: boolean
}

export function WindowControls({
  onMinimize,
  onToggleExpand,
  onClose,
  expanded,
}: WindowControlsProps) {
  return (
    <div className={styles.controls} role="group" aria-label="Controles da janela">
      <button
        className={styles.control}
        style={{ width: '40px', height: '44px' }}
        type="button"
        aria-label="Minimizar"
        onClick={onMinimize}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        className={styles.control}
        style={{ width: '40px', height: '44px' }}
        type="button"
        aria-label={expanded ? 'Recolher' : 'Expandir'}
        onClick={onToggleExpand}
      >
        <span aria-hidden="true">{expanded ? '↙' : '↗'}</span>
      </button>
      <button
        className={`${styles.control} ${styles.close}`}
        style={{ width: '40px', height: '44px' }}
        type="button"
        aria-label="Fechar"
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
