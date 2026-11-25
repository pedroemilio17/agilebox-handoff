import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DailyAnswersDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { useActor } from '../../shared/session/useActor'
import { isArchivedTask } from '../../shared/lib/task-signals'
import { queryKeys } from '../../shared/query/keys'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { useDailyToday } from '../use-daily-today'
import { DAILY_ANSWER_LIMIT, answerLength } from '../daily/daily-rules'
import { trayCopy } from '../copy'
import { logActorHours } from '../log-hours'
import { BackButton, OpenPanelButton, TrayHeader } from '../TrayHeader'
import styles from '../Tray.module.css'

type DailyStep = 1 | 2 | 3

export interface DailyScreenProps {
  readonly onSaved: () => void
  /** Sai sem salvar (← Voltar). */
  readonly onBack: () => void
}

function formatStep(hours: number): string {
  return `${hours.toFixed(1).replace('.', ',')}h`
}

/**
 * Atualização do dia em 3 passos (screen-daily): 1) tarefas trabalhadas, 2) horas por tarefa,
 * 3) bloqueio e foco de amanhã. Grava a mesma daily de sempre (progresso, próximo passo, bloqueio);
 * as horas entram nas tarefas pelo mesmo caminho do "Lançar horas".
 */
export function DailyScreen({ onSaved, onBack }: DailyScreenProps) {
  const api = useApi()
  const actor = useActor()
  const queryClient = useQueryClient()
  const capabilities = useCapabilities()
  const daily = useDailyToday()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(undefined, actor.actor?.userId),
    enabled: Boolean(actor.actor),
    queryFn: () =>
      api.tasks.listBoard(actor.actor?.role === 'manager' ? { forUserId: actor.actor.userId } : {}),
  })
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState<DailyStep>(1)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [hoursMap, setHoursMap] = useState<Record<string, number>>({})
  const [blockerText, setBlockerText] = useState('')
  const [tomorrowFocus, setTomorrowFocus] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const hoursLogged = useRef(new Set<string>())

  const creatingBlocked = capabilities.isWindingDown('checkins') && daily.data?.entry === null

  // Uma vez: preenche com a daily de hoje, se já existir, para editar.
  useEffect(() => {
    if (loaded || !daily.data) return
    setLoaded(true)
    const entry = daily.data.entry
    if (entry) {
      setCheckedIds(entry.taskRefs)
      setBlockerText(entry.answers.blocker)
      setTomorrowFocus(entry.answers.nextStep)
    }
  }, [daily.data, loaded])

  useEffect(() => {
    if (loaded) headingRef.current?.focus()
  }, [loaded, step])

  const availableTasks = (tasks.data?.tasks ?? []).filter((task) => !isArchivedTask(task))

  const save = useMutation({
    mutationFn: async (draft: {
      date: string
      answers: DailyAnswersDto
      noNews: boolean
      taskRefs: string[]
    }) => {
      await api.daily.save(draft)
      const userId = actor.actor?.userId
      if (!userId) return
      for (const taskId of draft.taskRefs) {
        const hours = hoursMap[taskId] ?? 0
        if (hours <= 0 || hoursLogged.current.has(taskId)) continue
        await logActorHours(api, { taskId, userId, hours })
        hoursLogged.current.add(taskId)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.daily.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      onSaved()
    },
    onError: () => setFeedback(trayCopy.dailySaveError),
  })

  const header = (
    <TrayHeader
      left={
        <>
          <BackButton onClick={onBack} />
          <h1 className={styles.headerTitle}>{trayCopy.dailyTitle}</h1>
        </>
      }
      actions={
        <>
          <span className={styles.dailyStepBadge}>{trayCopy.dailyStepOfThree(step)}</span>
          <OpenPanelButton />
        </>
      }
    />
  )

  if (daily.isError || (!daily.isPending && !daily.data)) {
    return (
      <>
        {header}
        <p role="alert" className={styles.errorText}>
          {trayCopy.dailyLoadError}
        </p>
      </>
    )
  }
  if (!loaded || !daily.data) {
    return (
      <>
        {header}
        <p role="status" className={styles.mutedLine}>
          {trayCopy.dailyLoading}
        </p>
      </>
    )
  }

  const date = daily.data.date
  const selected = availableTasks.filter((task) => checkedIds.includes(task.id))

  const finish = (noNews: boolean) => {
    if (save.isPending) return
    if (creatingBlocked) {
      setFeedback(trayCopy.dailyWindingDown)
      return
    }
    const blocker = blockerText.trim()
    const nextStep = tomorrowFocus.trim()
    if (answerLength(blocker) > DAILY_ANSWER_LIMIT || answerLength(nextStep) > DAILY_ANSWER_LIMIT) {
      setFeedback(trayCopy.dailyTooLong)
      return
    }
    const progress = noNews
      ? ''
      : Array.from(
          selected.length > 0
            ? trayCopy.dailyProgressSummary(
                selected.map((task) => `${task.key} · ${task.title}`).join('; '),
              )
            : '',
        )
          .slice(0, DAILY_ANSWER_LIMIT)
          .join('')
    const empty = progress === '' && blocker === '' && nextStep === ''
    setFeedback(null)
    save.mutate({
      date,
      answers: noNews
        ? { progress: '', nextStep: '', blocker: '' }
        : { progress, nextStep, blocker },
      noNews: noNews || empty,
      taskRefs: noNews ? [] : checkedIds.filter((id) => selected.some((task) => task.id === id)),
    })
  }

  const goBackStep = () => {
    setFeedback(null)
    setStep((current) => (current === 3 ? 2 : 1))
  }

  const bumpHours = (taskId: string, delta: number) =>
    setHoursMap((current) => ({
      ...current,
      [taskId]: Math.max(0, (current[taskId] ?? 0) + delta),
    }))

  return (
    <>
      {header}
      <div
        className={styles.dailyProgress}
        role="progressbar"
        aria-label={trayCopy.dailyProgressAria}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={step}
      >
        <div
          className={styles.dailyProgressFill}
          style={{ width: `${step === 1 ? 33 : step === 2 ? 66 : 100}%` }}
        />
      </div>

      <div className={`${styles.body} ${styles.dailyBody}`}>
        {step === 1 ? (
          <>
            <div className={styles.dailyStepHead}>
              <h2 ref={headingRef} tabIndex={-1} className={styles.dailyStepTitle}>
                {trayCopy.dailyHeadStep1}
              </h2>
              <p className={styles.dailyStepSub}>{trayCopy.dailyHeadStep1Sub}</p>
            </div>
            {availableTasks.length === 0 ? (
              <div className={styles.dailyEmpty}>{trayCopy.dailyNoTasks}</div>
            ) : (
              availableTasks.map((task) => (
                <label key={task.id} className={styles.dailyCheckRow}>
                  <input
                    type="checkbox"
                    checked={checkedIds.includes(task.id)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked
                      setCheckedIds((current) =>
                        checked
                          ? current.includes(task.id)
                            ? current
                            : [...current, task.id]
                          : current.filter((id) => id !== task.id),
                      )
                    }}
                  />
                  <span className={styles.dailyCheckText}>
                    <strong>{task.key}</strong> · {task.title}
                  </span>
                </label>
              ))
            )}
          </>
        ) : step === 2 ? (
          <>
            <div className={styles.dailyStepHead}>
              <h2 ref={headingRef} tabIndex={-1} className={styles.dailyStepTitle}>
                {trayCopy.dailyHeadStep2}
              </h2>
              <p className={styles.dailyStepSub}>{trayCopy.dailyHeadStep2Sub}</p>
            </div>
            {selected.length === 0 ? (
              <div className={styles.dailyEmpty}>{trayCopy.dailyStep2Empty}</div>
            ) : (
              selected.map((task) => {
                const hours = hoursMap[task.id] ?? 0
                return (
                  <div key={task.id} className={styles.dailyHourRow}>
                    <div className={styles.dailyHourInfo}>
                      <div className={styles.dailyHourKey}>{task.key}</div>
                      <div className={styles.dailyHourTitle}>{task.title}</div>
                    </div>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.stepBtn}
                        aria-label={`Menos 0,5 hora em ${task.key}`}
                        onClick={() => bumpHours(task.id, -0.5)}
                      >
                        −0,5
                      </button>
                      <span className={styles.stepValue}>{formatStep(hours)}</span>
                      <button
                        type="button"
                        className={styles.stepBtn}
                        aria-label={`Mais 0,5 hora em ${task.key}`}
                        onClick={() => bumpHours(task.id, 0.5)}
                      >
                        +0,5
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </>
        ) : (
          <>
            <div className={styles.dailyStepHead}>
              <h2 ref={headingRef} tabIndex={-1} className={styles.dailyStepTitle}>
                {trayCopy.dailyHeadStep3}
              </h2>
              <p className={styles.dailyStepSub}>{trayCopy.dailyHeadStep3Sub}</p>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="daily-blocker-inp">
                {trayCopy.dailyBlockerFieldLabel}
              </label>
              <textarea
                id="daily-blocker-inp"
                className={`${styles.textarea} ${styles.dailyTextarea}`}
                rows={2}
                placeholder={trayCopy.dailyBlockerFieldPlaceholder}
                value={blockerText}
                onChange={(event) => setBlockerText(event.currentTarget.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="daily-tomorrow-inp">
                {trayCopy.dailyTomorrowLabel}
              </label>
              <input
                id="daily-tomorrow-inp"
                type="text"
                className={styles.input}
                placeholder={trayCopy.dailyTomorrowPlaceholder}
                value={tomorrowFocus}
                onChange={(event) => setTomorrowFocus(event.currentTarget.value)}
              />
            </div>
          </>
        )}
        {feedback ? (
          <p role="alert" className={styles.errorText}>
            {feedback}
          </p>
        ) : null}
      </div>

      <footer className={styles.fixedFooter}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          disabled={save.isPending}
          onClick={step === 1 ? () => finish(true) : goBackStep}
        >
          {step === 1 ? trayCopy.dailyNoNewsButton : trayCopy.dailyBackButton}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={save.isPending}
          onClick={() => {
            if (step === 3) finish(false)
            else {
              setFeedback(null)
              setStep(step === 1 ? 2 : 3)
            }
          }}
        >
          {step === 3 ? trayCopy.dailyFinishButton : trayCopy.dailyNextButton}
        </button>
      </footer>
    </>
  )
}
