import { useId, useState } from 'react'
import styles from './JargonTip.module.css'

export interface JargonTipProps {
  readonly term: string
  readonly description: string
  readonly placement?: 'above' | 'below'
  readonly className?: string
}

export function JargonTip({ term, description, placement = 'above', className }: JargonTipProps) {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  const classes = [styles.root, placement === 'below' ? styles.below : null, className]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={classes}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={`Explicação sobre ${term}`}
        aria-describedby={open ? tipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open ? (
        <span id={tipId} role="tooltip" className={styles.popover}>
          {description}
        </span>
      ) : null}
    </span>
  )
}
