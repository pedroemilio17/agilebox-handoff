import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, NumberField } from '@agilebox/ui'
import { SPRINTS_MAX_ACTIVE_DEFAULT } from '@agilebox/core'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { refusalMessage } from '../backlog/refusal-message'
import { panelCopy } from '../copy'
import styles from './SprintLimitField.module.css'

export const SPRINT_LIMIT_MIN = 1
export const SPRINT_LIMIT_MAX = 5
const LIMIT_MESSAGE = 'Limite de sprints ativas deve ser um número inteiro de 1 a 5'

/** Lê o limite gravado no módulo; sem valor, vale o padrão do domínio (uma sprint ativa). */
export function sprintLimitOf(
  config: Readonly<Record<string, unknown>> | null | undefined,
): number {
  const value = config?.maxActiveSprints
  return typeof value === 'number' ? value : SPRINTS_MAX_ACTIVE_DEFAULT
}

/** Valida o texto digitado: inteiro de 1 a 5, sem casas decimais nem texto. */
export function parseSprintLimit(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value >= SPRINT_LIMIT_MIN && value <= SPRINT_LIMIT_MAX ? value : null
}

export interface SprintLimitFieldProps {
  readonly value: number
  /** Só o gestor grava; quem é colaborador vê o valor em leitura. */
  readonly canManage: boolean
}

/** "Sprints ativas ao mesmo tempo" na linha da ferramenta Sprints, com módulo ativo. */
export function SprintLimitField({ value, canManage }: SprintLimitFieldProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (limit: number) =>
      api.teamTools.setModuleConfig({ moduleId: 'sprints', config: { maxActiveSprints: limit } }),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamTools.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all })
    },
    onError: (failure) => setError(refusalMessage(failure, panelCopy.teamToolChangeError)),
  })

  if (!canManage) {
    return <p className={styles.readOnly}>{`Sprints ativas ao mesmo tempo: ${value}`}</p>
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const limit = parseSprintLimit(draft)
    if (limit === null) {
      setError(LIMIT_MESSAGE)
      return
    }
    setError(null)
    save.mutate(limit)
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit} aria-label="Limite de sprints">
      <NumberField
        id={inputId}
        label="Sprints ativas ao mesmo tempo"
        min={SPRINT_LIMIT_MIN}
        max={SPRINT_LIMIT_MAX}
        step={1}
        value={draft}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        disabled={save.isPending}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          if (error) setError(null)
        }}
      />
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar limite'}
      </Button>
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </form>
  )
}
