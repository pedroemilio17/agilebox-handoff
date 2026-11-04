import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DailyAnswersDto } from '@agilebox/contract'
import { Button, ChecklistConfirm, StepIndicator, TextArea } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useActor } from '../../shared/session/useActor'
import { queryKeys } from '../../shared/query/keys'
import { useDailyToday } from '../use-daily-today'
import {
  DAILY_ANSWER_LIMIT,
  EMPTY_DAILY_ANSWERS,
  answerLength,
  hasDailyText,
  validateDailyDraft,
} from '../daily/daily-rules'
import { trayCopy } from '../copy'
import trayStyles from '../Tray.module.css'
import styles from './Daily.module.css'

type AnswerKey = keyof DailyAnswersDto
type DailyStep = 1 | 2 | 3 | 'review'

/** Cada passo de resposta grava um campo da daily. */
const ANSWER_BY_STEP: Record<1 | 2 | 3, AnswerKey> = { 1: 'progress', 2: 'nextStep', 3: 'blocker' }

export interface DailyScreenProps {
  readonly onSaved: () => void
  /** Sai da tela sem salvar. */
  readonly onExit: () => void
  /** A tela registra aqui a ação de sair (Voltar e Esc), que pede confirmação se houver texto. */
  readonly exitRef: { current: (() => void) | null }
}

interface AnswerFieldProps {
  readonly id: string
  readonly label: string
  readonly placeholder: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (value: string) => void
  readonly onAdvance: () => void
}

/** Campo de resposta com contador. Sem limite no campo: o limite bloqueia ao avançar, sem perder o texto. */
function AnswerField({
  id,
  label,
  placeholder,
  value,
  disabled,
  onChange,
  onAdvance,
}: AnswerFieldProps) {
  const length = answerLength(value)
  const over = length > DAILY_ANSWER_LIMIT
  const hintId = `${id}-hint`
  const countId = `${id}-count`
  return (
    <div className={styles.field}>
      <TextArea
        id={id}
        label={label}
        placeholder={placeholder}
        rows={4}
        value={value}
        disabled={disabled}
        aria-describedby={`${hintId} ${countId}`}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          // Enter quebra linha; Ctrl+Enter (ou Cmd+Enter) avança.
          if (
            event.key !== 'Enter' ||
            !(event.ctrlKey || event.metaKey) ||
            event.nativeEvent.isComposing
          )
            return
          event.preventDefault()
          onAdvance()
        }}
      />
      <div className={styles.counterRow}>
        <span id={hintId}>{trayCopy.dailyShortcut}</span>
        <span id={countId} className={over ? styles.counterOver : undefined}>
          {`${length}/${DAILY_ANSWER_LIMIT}`}
        </span>
      </div>
    </div>
  )
}

/** Daily de hoje em 3 passos (progresso, próximo passo, bloqueio) e resumo antes de concluir. */
export function DailyScreen({ onSaved, onExit, exitRef }: DailyScreenProps) {
  const api = useApi()
  const actor = useActor()
  const queryClient = useQueryClient()
  const daily = useDailyToday()
  const tasks = useQuery({
    queryKey: queryKeys.tasks.board(undefined, actor.actor?.userId),
    enabled: Boolean(actor.actor),
    queryFn: () =>
      api.tasks.listBoard(actor.actor?.role === 'manager' ? { forUserId: actor.actor.userId } : {}),
  })
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState<DailyStep>(1)
  const [answers, setAnswers] = useState<DailyAnswersDto>(EMPTY_DAILY_ANSWERS)
  const [taskRefs, setTaskRefs] = useState<string[]>([])
  const [noNews, setNoNews] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const discardRef = useRef<HTMLDivElement>(null)

  // Uma vez: preenche com a daily de hoje, se já existir, para editar.
  useEffect(() => {
    if (loaded || !daily.data) return
    setLoaded(true)
    const entry = daily.data.entry
    if (entry) {
      setAnswers(entry.answers)
      setTaskRefs(entry.taskRefs)
      setNoNews(entry.noNews)
    }
  }, [daily.data, loaded])

  const save = useMutation({
    mutationFn: (draft: {
      date: string
      answers: DailyAnswersDto
      noNews: boolean
      taskRefs: string[]
    }) =>
      api.daily.save({
        date: draft.date,
        answers: draft.answers,
        noNews: draft.noNews,
        taskRefs: draft.taskRefs,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.daily.all })
      onSaved()
    },
  })

  // Foco no título do passo ao abrir e a cada troca de passo.
  useEffect(() => {
    if (loaded) headingRef.current?.focus()
  }, [loaded, step])

  useEffect(() => {
    if (discardOpen) discardRef.current?.focus()
  }, [discardOpen])

  const dirty = hasDailyText(answers)
  const requestExit = () => {
    if (dirty) setDiscardOpen(true)
    else onExit()
  }

  useEffect(() => {
    exitRef.current = requestExit
  })
  useEffect(
    () => () => {
      exitRef.current = null
    },
    [exitRef],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      event.preventDefault()
      if (discardOpen) {
        setDiscardOpen(false)
        return
      }
      requestExit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (daily.isError || (!daily.isPending && !daily.data)) {
    return (
      <div className={trayStyles.screenBody}>
        <p role="alert">{trayCopy.dailyLoadError}</p>
      </div>
    )
  }
  if (!loaded || !daily.data) {
    return (
      <div className={trayStyles.screenBody}>
        <p role="status">{trayCopy.dailyLoading}</p>
      </div>
    )
  }

  const date = daily.data.date
  const editing = daily.data.entry !== null
  const taskItems = (tasks.data?.tasks ?? []).map((task) => ({
    id: task.id,
    title: `${task.key} · ${task.title}`,
  }))
  const checkedTasks = new Set(taskRefs)

  const updateAnswer = (key: AnswerKey, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }))
    // Escrever texto tira a marca de "Sem novidades"; a daily vale pelo texto.
    setNoNews(false)
    setFeedback(null)
  }

  const toggleTask = (id: string, checked: boolean) => {
    setTaskRefs((current) => {
      if (checked) return current.includes(id) ? current : [...current, id]
      return current.filter((item) => item !== id)
    })
  }

  const finish = () => {
    if (save.isPending) return
    const problem = validateDailyDraft(answers, noNews)
    if (problem) {
      setFeedback(problem)
      return
    }
    setFeedback(null)
    save.mutate({ date, answers, noNews, taskRefs })
  }

  const goNext = () => {
    if (step === 'review') {
      finish()
      return
    }
    if (answerLength(answers[ANSWER_BY_STEP[step]]) > DAILY_ANSWER_LIMIT) {
      setFeedback(trayCopy.dailyTooLong)
      return
    }
    setFeedback(null)
    setStep(step === 1 ? 2 : step === 2 ? 3 : 'review')
  }

  const markNoNews = () => {
    if (save.isPending) return
    if (hasDailyText(answers)) {
      setFeedback(trayCopy.dailyNoNewsBlocked)
      return
    }
    setFeedback(null)
    save.mutate({ date, answers, noNews: true, taskRefs })
  }

  const message = feedback ?? (save.isError ? trayCopy.dailySaveError : null)
  const stepNumber = step === 'review' ? 3 : step
  const busy = save.isPending
  const citedTitles = taskRefs
    .map((id) => taskItems.find((item) => item.id === id)?.title)
    .filter((title): title is string => title !== undefined)

  return (
    <form
      className={trayStyles.screenBody}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        goNext()
      }}
    >
      <h2 className={styles.dailyTitle}>
        {editing ? trayCopy.dailyEditTitle : trayCopy.dailyTitle}
      </h2>
      <StepIndicator current={stepNumber} total={3} />

      {step === 1 ? (
        <>
          <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            {trayCopy.dailyStep1Title}
          </h3>
          <p className={styles.stepHint}>{trayCopy.dailyStep1Hint}</p>
          {noNews ? <p className={styles.notice}>{trayCopy.dailyNoNewsMarked}</p> : null}
          {tasks.isPending ? (
            <p role="status" className={styles.stepHint}>
              {trayCopy.dailyTasksLoading}
            </p>
          ) : tasks.isError ? (
            <p role="alert" className={styles.stepHint}>
              {trayCopy.dailyTasksError}
            </p>
          ) : taskItems.length === 0 ? (
            <p className={styles.stepHint}>{trayCopy.dailyNoTasks}</p>
          ) : (
            <ChecklistConfirm
              label={trayCopy.dailyTasksLabel}
              items={taskItems}
              checkedIds={checkedTasks}
              onToggle={toggleTask}
              disabled={busy}
            />
          )}
          <AnswerField
            id="daily-progress"
            label={trayCopy.dailyProgressLabel}
            placeholder={trayCopy.dailyProgressPlaceholder}
            value={answers.progress}
            disabled={busy}
            onChange={(value) => updateAnswer('progress', value)}
            onAdvance={goNext}
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            {trayCopy.dailyStep2Title}
          </h3>
          <AnswerField
            id="daily-next"
            label={trayCopy.dailyNextLabel}
            placeholder={trayCopy.dailyNextPlaceholder}
            value={answers.nextStep}
            disabled={busy}
            onChange={(value) => updateAnswer('nextStep', value)}
            onAdvance={goNext}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            {trayCopy.dailyStep3Title}
          </h3>
          <AnswerField
            id="daily-blocker"
            label={trayCopy.dailyBlockerLabel}
            placeholder={trayCopy.dailyBlockerPlaceholder}
            value={answers.blocker}
            disabled={busy}
            onChange={(value) => updateAnswer('blocker', value)}
            onAdvance={goNext}
          />
        </>
      ) : null}

      {step === 'review' ? (
        <>
          <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            {trayCopy.dailyReviewTitle}
          </h3>
          {noNews ? (
            <p className={styles.notice}>{trayCopy.dailySummaryNoNews}</p>
          ) : (
            <dl className={styles.summary}>
              <div>
                <dt>{trayCopy.dailySummaryProgress}</dt>
                <dd>{answers.progress.trim() || trayCopy.dailySummaryNone}</dd>
              </div>
              <div>
                <dt>{trayCopy.dailySummaryNext}</dt>
                <dd>{answers.nextStep.trim() || trayCopy.dailySummaryNone}</dd>
              </div>
              <div>
                <dt>{trayCopy.dailySummaryBlocker}</dt>
                <dd>{answers.blocker.trim() || trayCopy.dailySummaryNone}</dd>
              </div>
              <div>
                <dt>{trayCopy.dailySummaryTasks}</dt>
                <dd>
                  {citedTitles.length > 0 ? citedTitles.join('\n') : trayCopy.dailySummaryNoTasks}
                </dd>
              </div>
            </dl>
          )}
        </>
      ) : null}

      <div aria-live="polite" className={styles.feedback}>
        {message}
      </div>

      {discardOpen ? (
        <div
          ref={discardRef}
          tabIndex={-1}
          role="group"
          aria-label={trayCopy.dailyDiscardQuestion}
          className={styles.discard}
        >
          <p>{trayCopy.dailyDiscardQuestion}</p>
          <div className={styles.discardActions}>
            <Button type="button" onClick={() => setDiscardOpen(false)}>
              {trayCopy.dailyKeepWriting}
            </Button>
            <Button type="button" onClick={onExit}>
              {trayCopy.dailyDiscard}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className={styles.footerRow}>
          <Button type="button" onClick={markNoNews} disabled={busy}>
            {trayCopy.dailyNoNews}
          </Button>
          <span className={styles.spacer} />
          <Button type="submit" variant="primary" disabled={busy}>
            {trayCopy.dailyNext}
          </Button>
        </div>
      ) : null}

      {step === 2 || step === 3 ? (
        <div className={styles.footerRow}>
          <Button type="button" onClick={() => setStep(step === 2 ? 1 : 2)} disabled={busy}>
            {trayCopy.dailyBack}
          </Button>
          <span className={styles.spacer} />
          <Button type="submit" variant="primary" disabled={busy}>
            {trayCopy.dailyNext}
          </Button>
        </div>
      ) : null}

      {step === 'review' ? (
        <div className={styles.footerRow}>
          <Button type="button" onClick={() => setStep(3)} disabled={busy}>
            {trayCopy.dailyBack}
          </Button>
          <span className={styles.spacer} />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? trayCopy.dailySaving : trayCopy.dailyFinish}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
