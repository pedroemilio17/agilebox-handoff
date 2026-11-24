import { useId, type InputHTMLAttributes } from 'react'
import styles from './Switch.module.css'

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'role' | 'onChange'
> {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly label?: string
}

export function Switch({
  checked,
  onChange,
  label,
  className,
  id,
  disabled,
  ...props
}: SwitchProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const classes = [styles.switch, className].filter(Boolean).join(' ')

  return (
    <label className={classes} htmlFor={inputId}>
      <input
        {...props}
        id={inputId}
        className={styles.input}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className={styles.track} aria-hidden="true" />
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  )
}
