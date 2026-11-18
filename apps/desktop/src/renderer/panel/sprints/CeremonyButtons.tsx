import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CEREMONY_KINDS, suggestCeremony } from '@agilebox/core'
import type { CeremonyKind } from '@agilebox/core'
import type { SprintDto } from '@agilebox/contract'
import { Button } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { refusalMessage } from '../backlog/refusal-message'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { sprintCopy } from './sprint-copy'
import styles from './SprintsView.module.css'

export interface CeremonyButtonsProps {
  readonly sprint: SprintDto
  readonly projectId: string
  readonly onNotify: (message: string) => void
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Atalhos para agendar planning, review e retro da sprint na Agenda. Cada clique cria o
 * agendamento com título, data e horário sugeridos (regra em `core`). Só o gestor vê esta seção,
 * e cada cerimônia é agendada uma vez por sprint nesta tela: o ajuste fino fica na Agenda.
 */
export function CeremonyButtons({ sprint, projectId, onNotify, onNavigate }: CeremonyButtonsProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [scheduled, setScheduled] = useState<readonly CeremonyKind[]>([])
  const [error, setError] = useState<string | null>(null)

  const schedule = useMutation({
    mutationFn: (ceremony: CeremonyKind) => {
      const suggestion = suggestCeremony(sprint, ceremony)
      return api.meetings.create({
        title: suggestion.title,
        date: suggestion.date,
        time: suggestion.time,
        kind: suggestion.meetingKind,
        participants: [],
      })
    },
    onSuccess: (_meeting, ceremony) => {
      setScheduled((current) => [...current, ceremony])
      setError(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all })
      onNotify(sprintCopy.ceremonyNotice(suggestCeremony(sprint, ceremony).title))
    },
    onError: (failure) => setError(refusalMessage(failure, sprintCopy.ceremonyError)),
  })

  return (
    <section className={styles.ceremonies} aria-label={sprintCopy.ceremoniesTitle}>
      <header className={styles.ceremoniesHeader}>
        <h4 className={styles.columnTitle}>{sprintCopy.ceremoniesTitle}</h4>
        <ModuleHelpButton
          moduleId="reviewRetro"
          projectId={projectId}
          {...(onNavigate ? { onNavigate } : {})}
        />
      </header>
      <p className={styles.meta}>{sprintCopy.ceremoniesHint}</p>
      <div className={styles.actions}>
        {CEREMONY_KINDS.map((ceremony) => {
          const done = scheduled.includes(ceremony)
          return (
            <Button
              key={ceremony}
              type="button"
              disabled={done || schedule.isPending}
              onClick={() => schedule.mutate(ceremony)}
            >
              {done ? sprintCopy.ceremonyScheduled[ceremony] : sprintCopy.ceremonyAction[ceremony]}
            </Button>
          )
        })}
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </section>
  )
}
