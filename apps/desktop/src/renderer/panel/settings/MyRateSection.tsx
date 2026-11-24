import { useEffect, useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, GlassSurface } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import styles from './SettingsView.module.css'

/**
 * Valor/hora padrão da própria pessoa (privado: o servidor só manda o valor que ela pode ver).
 * Grava pelo caso de uso de usuário, que aceita só o próprio valor para quem não é gestor.
 */
export function MyRateSection() {
  const api = useApi()
  const queryClient = useQueryClient()
  const { actor } = useActor()
  const users = useSessionUsers()
  const me = users.data?.find((user) => user.id === actor?.userId)
  const inputId = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Mostra o valor atual assim que a lista chega (e depois de cada gravação).
  useEffect(() => {
    if (me?.defaultRate !== undefined && me?.defaultRate !== null) setValue(String(me.defaultRate))
  }, [me?.defaultRate])

  const save = useMutation({
    mutationFn: (rateCents: number) =>
      api.users.setDefaultRate({ userId: me?.id ?? '', rateCents }),
    onSuccess: () => {
      setSaved(true)
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.users })
    },
    onError: () => setError(panelCopy.myRateError),
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reais = Number(value.replace(',', '.'))
    setSaved(false)
    if (!Number.isFinite(reais) || reais <= 0) {
      setError(panelCopy.myRateInvalid)
      return
    }
    setError(null)
    save.mutate(Math.round(reais * 100))
  }

  return (
    <GlassSurface variant="group" className={styles.section} aria-label={panelCopy.myRateTitle}>
      <h2 className={styles.sectionTitle}>{panelCopy.myRateTitle}</h2>
      <form className={styles.rateForm} onSubmit={onSubmit}>
        <label htmlFor={inputId} className={styles.label}>
          {panelCopy.myRateLabel}
        </label>
        <div className={styles.rateControls}>
          <input
            id={inputId}
            className={styles.rateInput}
            type="number"
            min={0}
            step={5}
            value={value}
            disabled={!me}
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => {
              setValue(event.currentTarget.value)
              setSaved(false)
            }}
          />
          <Button type="submit" variant="primary" disabled={!me || save.isPending}>
            {panelCopy.myRateSave}
          </Button>
        </div>
        <p id={`${inputId}-hint`} className={styles.hint}>
          {panelCopy.myRateHint}
        </p>
        {saved ? (
          <p role="status" className={styles.hint}>
            {panelCopy.myRateSaved}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className={styles.hint}>
            {error}
          </p>
        ) : null}
      </form>
    </GlassSurface>
  )
}
