import { useState } from 'react'
import type { GetTaskDto, ParticipationSummaryDto } from '@agilebox/contract'
import { formatBRL, parseHours, parseMoney, subtotal } from '@agilebox/core'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { SaveError } from './SaveError'
import { taskCopy } from './task-detail-copy'
import { addHours, formatHoursLabel } from './hours-format'
import { useSetHours, useSetRate } from './use-participations'
import styles from './TaskDetailView.module.css'

export interface HoursSectionProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
}

interface Draft {
  readonly hours?: string
  readonly rate?: string
}

type Field = 'hours' | 'rate'

const hoursText = (hours: number) => String(hours).replace('.', ',')
const rateText = (rate: number) => rate.toFixed(2).replace('.', ',')

function safeHundredths(parse: (text: string) => number, text: string, fallback: number): number {
  try {
    return parse(text)
  } catch {
    return fallback
  }
}

function lineSubtotal(participation: ParticipationSummaryDto, draft: Draft | undefined) {
  if (participation.rate === null) return null
  const hours = safeHundredths(
    parseHours,
    draft?.hours ?? '',
    Math.round(participation.hours * 100),
  )
  const rate = safeHundredths(parseMoney, draft?.rate ?? '', Math.round(participation.rate * 100))
  return subtotal(hours, rate)
}

/** Horas e custo da tarefa: lançamento rápido, valor/h do próprio usuário e o detalhamento por pessoa. */
export function HoursSection({ task, readOnly }: HoursSectionProps) {
  const { actor } = useActor()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [editing, setEditing] = useState<{ id: string; field: Field } | null>(null)
  const [manualHours, setManualHours] = useState('')
  const [rateDraft, setRateDraft] = useState<string | null>(null)
  const [rateNoticeShown, setRateNoticeShown] = useState(false)
  const setHours = useSetHours(task.id)
  const setRate = useSetRate(task.id)

  const isManager = actor?.role === 'manager'
  const costEnabled = task.costEnabled
  const own = task.participations.find(
    (participation) =>
      participation.participant.kind === 'user' &&
      participation.participant.userId === actor?.userId,
  )
  const canLog = !readOnly && own !== undefined

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
    value: lineSubtotal(participation, drafts[participation.id]),
  }))
  const totalHours = task.participations.reduce((sum, p) => sum + p.hours, 0)
  const totalCost =
    task.total === null ? null : lines.reduce((sum, line) => sum + (line.value ?? 0), 0)

  function saveHours(participation: ParticipationSummaryDto) {
    setEditing(null)
    const text = drafts[participation.id]?.hours
    if (text === undefined) return
    if (text.trim() === hoursText(participation.hours)) return clear(participation.id, 'hours')
    setHours.mutate(
      { participationId: participation.id, hours: text.trim() },
      { onSettled: () => clear(participation.id, 'hours') },
    )
  }

  function saveRate(participation: ParticipationSummaryDto) {
    setEditing(null)
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

  function logHours(amount: number) {
    if (!own || !Number.isFinite(amount) || amount <= 0) return
    setHours.mutate({
      participationId: own.id,
      hours: hoursText(addHours(own.hours, amount)),
    })
  }

  function submitManual() {
    const amount = Number.parseFloat(manualHours.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) return
    setManualHours('')
    logHours(amount)
  }

  function saveOwnRate() {
    if (!own || own.rate === null) return
    const text = rateDraft ?? rateText(own.rate)
    const cents = safeHundredths(parseMoney, text.replace('.', ','), 0)
    if (cents <= 0) return
    setRate.mutate(
      { participationId: own.id, participant: own.participant, rateCents: cents },
      { onSettled: () => setRateDraft(null) },
    )
    setRateNoticeShown(true)
  }

  function cell(
    participation: ParticipationSummaryDto,
    field: Field,
    display: string,
    label: string,
    initial: string,
  ) {
    const key = { id: participation.id, field }
    const isEditing = editing?.id === key.id && editing.field === field
    const draftValue = drafts[participation.id]?.[field]
    if (readOnly) return <span>{display}</span>
    if (!isEditing) {
      return (
        <button
          type="button"
          className={styles.rowAction}
          style={{ color: 'inherit', fontSize: 'inherit', minWidth: 0 }}
          aria-label={label}
          onClick={() => {
            patch(participation.id, { [field]: draftValue ?? initial })
            setEditing(key)
          }}
        >
          {display}
        </button>
      )
    }
    return (
      <input
        aria-label={label}
        className={styles.cellInput}
        inputMode="decimal"
        autoFocus
        value={draftValue ?? initial}
        onChange={(event) => patch(participation.id, { [field]: event.currentTarget.value })}
        onBlur={() => (field === 'hours' ? saveHours(participation) : saveRate(participation))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    )
  }

  const ownName = own?.participantName ?? ''

  return (
    <>
      <section className={styles.topicSection} aria-labelledby="task-section-log-hours">
        <div className={styles.topicSectionHead}>
          <h2 className={styles.topicSectionTitle} id="task-section-log-hours">
            {taskCopy.logHoursTitle}
          </h2>
          {costEnabled ? (
            <span className={isManager ? `${styles.badge} ${styles.badgeGestor}` : styles.badge}>
              {isManager ? taskCopy.managerBadge : taskCopy.privateBadge}
            </span>
          ) : null}
        </div>
        <div className={styles.hoursQuickRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
            disabled={!canLog || setHours.isPending}
            onClick={() => logHours(0.5)}
          >
            {taskCopy.addHalfHour}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
            disabled={!canLog || setHours.isPending}
            onClick={() => logHours(1)}
          >
            {taskCopy.addOneHour}
          </button>
          <input
            type="number"
            step="0.5"
            min="0.5"
            className={`${styles.input} ${styles.hoursInput}`}
            placeholder={taskCopy.manualHoursPlaceholder}
            aria-label={taskCopy.manualHoursAria}
            disabled={!canLog}
            value={manualHours}
            onChange={(event) => setManualHours(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitManual()
              }
            }}
          />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={!canLog || setHours.isPending}
            onClick={submitManual}
          >
            {taskCopy.manualHoursSubmit}
          </button>
        </div>
        {!readOnly && !own ? <p className={styles.kvHint}>{taskCopy.noOwnParticipation}</p> : null}

        {costEnabled && own && own.rate !== null ? (
          <div className={styles.rateBlock}>
            <label className={styles.fieldLabel} htmlFor="task-my-rate">
              {taskCopy.myRateLabel(ownName)}
            </label>
            <div className={`${styles.inlineAddRow} ${styles.rateRow}`}>
              <input
                id="task-my-rate"
                type="number"
                step="5"
                min="0"
                className={styles.input}
                disabled={readOnly}
                value={rateDraft ?? String(own.rate)}
                onChange={(event) => {
                  setRateDraft(event.currentTarget.value)
                  setRateNoticeShown(true)
                }}
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={readOnly || setRate.isPending}
                onClick={saveOwnRate}
              >
                {taskCopy.myRateSave}
              </button>
            </div>
            {rateNoticeShown ? (
              <div className={styles.rateNotice}>{taskCopy.rateNotice}</div>
            ) : null}
          </div>
        ) : null}
        <SaveError error={setHours.error ?? setRate.error} />
      </section>

      <section className={styles.topicSection} aria-labelledby="task-section-cost-table">
        <div className={styles.topicSectionHead}>
          <h2 className={styles.topicSectionTitle} id="task-section-cost-table">
            {taskCopy.costTableTitle}
          </h2>
        </div>
        <table className={styles.cleanTable} aria-label={taskCopy.costTableAria}>
          <thead>
            <tr>
              <th>{taskCopy.colPerson}</th>
              <th className={styles.num}>{taskCopy.colHours}</th>
              {costEnabled ? <th className={styles.num}>{taskCopy.colRate}</th> : null}
              {costEnabled ? <th className={styles.num}>{taskCopy.colSubtotal}</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map(({ participation, value }) => {
              const isOwn = participation.id === own?.id
              return (
                <tr key={participation.id}>
                  <td>
                    <span className={styles.personName}>{participation.participantName}</span>
                    {isOwn && !isManager ? (
                      <span className={styles.personYou}> {taskCopy.you}</span>
                    ) : null}
                  </td>
                  <td className={styles.num}>
                    {cell(
                      participation,
                      'hours',
                      formatHoursLabel(participation.hours),
                      panelCopy.hoursOf(participation.participantName),
                      hoursText(participation.hours),
                    )}
                  </td>
                  {costEnabled ? (
                    <td className={styles.num}>
                      {participation.rate === null ? (
                        <span className={styles.maskedVal} title={taskCopy.maskedTitle}>
                          {taskCopy.masked}
                        </span>
                      ) : (
                        <>
                          {cell(
                            participation,
                            'rate',
                            `${formatBRL(Math.round(participation.rate * 100))}/h`,
                            panelCopy.rateOf(participation.participantName),
                            rateText(participation.rate),
                          )}
                        </>
                      )}
                    </td>
                  ) : null}
                  {costEnabled ? (
                    <td className={styles.num}>
                      {value === null ? (
                        <span className={styles.maskedVal} title={taskCopy.maskedTitle}>
                          {taskCopy.masked}
                        </span>
                      ) : (
                        <output className={styles.cellStrong}>{formatBRL(value)}</output>
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className={styles.costSummaryRow}>
          {totalCost !== null && costEnabled ? (
            <>
              <span>{taskCopy.totalAccrued(formatHoursLabel(totalHours))}</span>
              <output aria-label={panelCopy.total} className={styles.costTotalValue}>
                {formatBRL(totalCost)}
              </output>
            </>
          ) : (
            <>
              <span>{taskCopy.totalTask(formatHoursLabel(totalHours))}</span>
              {costEnabled ? (
                <span className={styles.topicSectionMeta} title={taskCopy.restrictedTitle}>
                  {taskCopy.restricted}
                </span>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  )
}
