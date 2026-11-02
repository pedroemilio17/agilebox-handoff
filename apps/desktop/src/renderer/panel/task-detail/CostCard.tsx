import { useEffect, useState } from 'react'
import type { GetTaskDto, ParticipationSummaryDto } from '@agilebox/contract'
import { formatBRL, parseHours, parseMoney, subtotal } from '@agilebox/core'
import { PropertyRow } from './PropertyRow'
import { panelCopy } from '../copy'
import { SaveError } from './SaveError'
import { useSetHours, useSetRate } from './use-participations'
import styles from './TaskDetailView.module.css'

export interface CostCardProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  /** Horas editáveis: é o campo Estimativa, que some sem o módulo `estimates.hours` (M2.11). */
  readonly showHours: boolean
  /**
   * Valor/hora, subtotal e total: é o campo Custo por hora (M2.11). Sem permissão, o DTO já vem
   * com `rate` e `total` nulos, então a tela não mostra o que o servidor não enviou.
   */
  readonly showRate: boolean
}

interface Draft {
  readonly hours?: string
  readonly rate?: string
}

const hoursText = (hours: number) => String(hours).replace('.', ',')
const rateText = (rate: number) => rate.toFixed(2).replace('.', ',')

function safeHundredths(parse: (text: string) => number, text: string, fallback: number): number {
  try {
    return parse(text)
  } catch {
    return fallback
  }
}

/** Sem a coluna de horas, o rascunho de horas não vale: o subtotal usa o que está gravado. */
function withoutHourDrafts(drafts: Record<string, Draft>): Record<string, Draft> {
  return Object.fromEntries(
    Object.entries(drafts).map(([id, draft]) => [
      id,
      draft.rate === undefined ? {} : { rate: draft.rate },
    ]),
  )
}

function lineSubtotal(
  participation: ParticipationSummaryDto,
  draft: Draft | undefined,
  showHours: boolean,
) {
  if (participation.rate === null) return null
  const recorded = Math.round(participation.hours * 100)
  const hoursDraft = showHours ? draft?.hours : undefined
  const hours =
    hoursDraft === undefined ? recorded : safeHundredths(parseHours, hoursDraft, recorded)
  const rate = safeHundredths(parseMoney, draft?.rate ?? '', Math.round(participation.rate * 100))
  return subtotal(hours, rate)
}

function cardLabel(showHours: boolean, showRate: boolean): string {
  if (showHours && showRate) return 'Horas e custo'
  return showHours ? 'Estimativa de horas' : 'Custo por hora'
}

export function CostCard({ task, readOnly, showHours, showRate }: CostCardProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const setHours = useSetHours(task.id)
  const setRate = useSetRate(task.id)

  useEffect(() => {
    if (!showHours) setDrafts(withoutHourDrafts)
  }, [showHours])

  const patch = (id: string, value: Draft) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...value } }))
  const clear = (id: string, key: keyof Draft) =>
    setDrafts((current) => {
      const draft = { ...current[id] }
      delete draft[key]
      return { ...current, [id]: draft }
    })

  const lines = task.participations.map((participation) => ({
    participation,
    value: lineSubtotal(participation, drafts[participation.id], showHours),
  }))
  const total = task.total === null ? null : lines.reduce((sum, line) => sum + (line.value ?? 0), 0)

  function saveHours(participation: ParticipationSummaryDto) {
    const text = drafts[participation.id]?.hours
    if (text === undefined) return
    if (text.trim() === hoursText(participation.hours)) return clear(participation.id, 'hours')
    setHours.mutate(
      { participationId: participation.id, hours: text.trim() },
      { onSettled: () => clear(participation.id, 'hours') },
    )
  }

  function saveRate(participation: ParticipationSummaryDto) {
    const text = drafts[participation.id]?.rate
    if (text === undefined || participation.rate === null) return
    const cents = safeHundredths(parseMoney, text, 0)
    if (cents <= 0 || cents === Math.round(participation.rate * 100))
      return clear(participation.id, 'rate')
    setRate.mutate(
      {
        participationId: participation.id,
        participant: participation.participant,
        rateCents: cents,
      },
      { onSettled: () => clear(participation.id, 'rate') },
    )
  }

  const error = (showHours ? setHours.error : null) ?? (showRate ? setRate.error : null)

  return (
    <PropertyRow label={cardLabel(showHours, showRate)}>
      <div className={styles.propertyContent}>
        <ul className={styles.list}>
          {lines.map(({ participation, value }) => (
            <li key={participation.id} className={styles.costRow}>
              <span className={styles.grow}>{participation.participantName}</span>
              {showHours ? (
                <input
                  aria-label={panelCopy.hoursOf(participation.participantName)}
                  className={styles.numberInput}
                  inputMode="decimal"
                  disabled={readOnly}
                  value={drafts[participation.id]?.hours ?? hoursText(participation.hours)}
                  onChange={(event) =>
                    patch(participation.id, { hours: event.currentTarget.value })
                  }
                  onBlur={() => saveHours(participation)}
                />
              ) : (
                <span className={styles.helper}>{hoursText(participation.hours)} h</span>
              )}
              {!showRate || participation.rate === null ? null : (
                <>
                  <span aria-hidden="true">×</span>
                  <input
                    aria-label={panelCopy.rateOf(participation.participantName)}
                    className={styles.numberInput}
                    inputMode="decimal"
                    disabled={readOnly}
                    value={drafts[participation.id]?.rate ?? rateText(participation.rate)}
                    onChange={(event) =>
                      patch(participation.id, { rate: event.currentTarget.value })
                    }
                    onBlur={() => saveRate(participation)}
                  />
                  <output className={styles.subtotal}>{formatBRL(value ?? 0)}</output>
                </>
              )}
            </li>
          ))}
        </ul>
        {!showRate || total === null ? null : (
          <p className={styles.total}>
            <span>{panelCopy.total}</span>
            <output aria-label={panelCopy.total}>{formatBRL(total)}</output>
          </p>
        )}
        <SaveError error={error} />
      </div>
    </PropertyRow>
  )
}
