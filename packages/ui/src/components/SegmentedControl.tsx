import type { CSSProperties } from 'react'
import styles from './SegmentedControl.module.css'

export interface SegmentedOption<Value extends string = string> {
  readonly value: Value
  readonly label: string
}

export interface SegmentedControlProps<Value extends string = string> {
  readonly options: readonly [
    SegmentedOption<Value>,
    SegmentedOption<Value>,
    ...SegmentedOption<Value>[],
  ]
  readonly value: Value
  readonly onChange: (value: Value) => void
  readonly 'aria-label': string
  readonly size?: 'md' | 'sm'
  readonly className?: string
}

export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  size = 'md',
  className,
}: SegmentedControlProps<Value>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const classes = [styles.control, size === 'sm' ? styles.sm : null, className]
    .filter(Boolean)
    .join(' ')
  const thumbStyle: CSSProperties = {
    left: `${(100 / options.length) * selectedIndex}%`,
    width: `${100 / options.length}%`,
  }

  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      <div className={styles.track}>
        <span className={styles.thumb} aria-hidden="true" style={thumbStyle} />
        {options.map((option) => (
          <button
            key={option.value}
            className={styles.option}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
