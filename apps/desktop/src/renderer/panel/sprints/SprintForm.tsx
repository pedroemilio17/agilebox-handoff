import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, DateField, TextArea, TextField } from '@agilebox/ui'
import { sprintCopy } from './sprint-copy'
import { validateSprintForm, type SprintFormErrors, type SprintFormValues } from './sprint-rules'
import styles from './SprintsView.module.css'

const GOAL_MAX = 280

export interface SprintFormProps {
  readonly initial: SprintFormValues
  readonly submitLabel: string
  readonly busy: boolean
  readonly error: string | null
  readonly onSubmit: (values: SprintFormValues) => void
  readonly onCancel: () => void
}

/** Nova sprint e edição: mesmos campos e mensagens. Validação antes de enviar; o domínio confirma. */
export function SprintForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: SprintFormProps) {
  const [values, setValues] = useState<SprintFormValues>(initial)
  const [errors, setErrors] = useState<SprintFormErrors>({})
  const formId = useId()

  const update = (field: keyof SprintFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateSprintForm(values)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    onSubmit(values)
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit} aria-label={submitLabel}>
      <TextField
        id={`${formId}-name`}
        label={sprintCopy.nameLabel}
        value={values.name}
        aria-invalid={errors.name !== undefined}
        aria-describedby={`${formId}-name-hint`}
        onChange={(event) => update('name', event.currentTarget.value)}
      />
      <p id={`${formId}-name-hint`} className={styles.hint}>
        {sprintCopy.nameHint}
      </p>
      {errors.name ? <FieldError id={`${formId}-name-error`} message={errors.name} /> : null}

      <TextArea
        id={`${formId}-goal`}
        label={sprintCopy.goalLabel}
        value={values.goal}
        rows={2}
        aria-invalid={errors.goal !== undefined}
        aria-describedby={`${formId}-goal-count`}
        onChange={(event) => update('goal', event.currentTarget.value)}
      />
      <p id={`${formId}-goal-count`} className={styles.hint}>
        {sprintCopy.goalCounter(Array.from(values.goal.trim()).length, GOAL_MAX)}
      </p>
      {errors.goal ? <FieldError id={`${formId}-goal-error`} message={errors.goal} /> : null}

      <div className={styles.dates}>
        <div>
          <DateField
            id={`${formId}-start`}
            label={sprintCopy.plannedStartLabel}
            value={values.plannedStart}
            aria-invalid={errors.plannedStart !== undefined}
            onChange={(event) => update('plannedStart', event.currentTarget.value)}
          />
          {errors.plannedStart ? (
            <FieldError id={`${formId}-start-error`} message={errors.plannedStart} />
          ) : null}
        </div>
        <div>
          <DateField
            id={`${formId}-end`}
            label={sprintCopy.plannedEndLabel}
            value={values.plannedEnd}
            aria-invalid={errors.plannedEnd !== undefined}
            onChange={(event) => update('plannedEnd', event.currentTarget.value)}
          />
          {errors.plannedEnd ? (
            <FieldError id={`${formId}-end-error`} message={errors.plannedEnd} />
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? sprintCopy.saving : submitLabel}
        </Button>
        <Button type="button" onClick={onCancel} disabled={busy}>
          {sprintCopy.cancel}
        </Button>
      </div>
    </form>
  )
}

function FieldError({ id, message }: { readonly id: string; readonly message: string }) {
  return (
    <p id={id} role="alert" className={styles.error}>
      {message}
    </p>
  )
}
