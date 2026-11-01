import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import styles from './Fields.module.css'

interface LabeledFieldProps {
  readonly label: string
  readonly className?: string
}

export type TextFieldProps = LabeledFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function TextField({ label, className, id, ...props }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const classes = [styles.input, className].filter(Boolean).join(' ')

  return (
    <label className={styles.field} htmlFor={fieldId}>
      <span className={styles.label}>{label}</span>
      <input {...props} id={fieldId} className={classes} type="text" />
    </label>
  )
}

export type TextAreaProps = LabeledFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export function TextArea({ label, className, id, ...props }: TextAreaProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const classes = [styles.textarea, className].filter(Boolean).join(' ')

  return (
    <label className={styles.field} htmlFor={fieldId}>
      <span className={styles.label}>{label}</span>
      <textarea {...props} id={fieldId} className={classes} />
    </label>
  )
}

export type DateFieldProps = LabeledFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function DateField({ label, className, id, ...props }: DateFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const classes = [styles.input, className].filter(Boolean).join(' ')

  return (
    <label className={styles.field} htmlFor={fieldId}>
      <span className={styles.label}>{label}</span>
      <input {...props} id={fieldId} className={classes} type="date" />
    </label>
  )
}

export type NumberFieldProps = LabeledFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'>

export function NumberField({ label, className, id, ...props }: NumberFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const classes = [styles.input, className].filter(Boolean).join(' ')

  return (
    <label className={styles.field} htmlFor={fieldId}>
      <span className={styles.label}>{label}</span>
      <input {...props} id={fieldId} className={classes} type="text" inputMode="decimal" />
    </label>
  )
}
