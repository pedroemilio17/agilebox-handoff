import styles from './WindowControls.module.css'

export interface WindowControlsProps {
  readonly onMinimize: () => void
  readonly onToggleExpand: () => void
  readonly onClose: () => void
  readonly expanded: boolean
  readonly compact?: boolean
}

export function WindowControls({
  onMinimize,
  onToggleExpand,
  onClose,
  expanded,
  compact = false,
}: WindowControlsProps) {
  const inlineSize = compact ? undefined : { width: '40px', height: '44px' }
  const groupClasses = [styles.controls, compact ? styles.compact : null].filter(Boolean).join(' ')

  return (
    <div className={groupClasses} role="group" aria-label="Controles da janela">
      <button
        className={styles.control}
        style={inlineSize}
        type="button"
        aria-label="Minimizar"
        onClick={onMinimize}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        className={styles.control}
        style={inlineSize}
        type="button"
        aria-label={expanded ? 'Recolher' : 'Expandir'}
        onClick={onToggleExpand}
      >
        <span aria-hidden="true">{expanded ? '↙' : '↗'}</span>
      </button>
      <button
        className={`${styles.control} ${styles.close}`}
        style={inlineSize}
        type="button"
        aria-label="Fechar"
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
