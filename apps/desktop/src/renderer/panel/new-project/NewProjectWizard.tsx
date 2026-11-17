import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { WizardAnswers } from '@agilebox/core'
import { Button, TextField, useFocusTrap, useRestoreFocus } from '@agilebox/ui'
import styles from './NewProjectWizard.module.css'
import {
  nextStep,
  previousStep,
  progressPercent,
  questionById,
  questionPosition,
  railSteps,
  remainingLabel,
  remainingSteps,
  toWizardAnswers,
  totalSteps,
  withAnswer,
  type StepId,
  type WizardDraft,
} from './wizard-steps'

export interface NewProjectWizardProps {
  readonly initialName?: string
  readonly onCancel: () => void
  /** Cria o projeto no modo Simples, sem respostas. */
  readonly onSkip: (name: string) => void
  /** Segue para a recomendação com as respostas dadas. */
  readonly onFinishQuestions: (name: string, answers: WizardAnswers) => void
}

const NAME_REQUIRED = 'Dê um nome ao projeto para continuar.'

/**
 * Assistente de novo projeto (ADR-10), perguntas 1 a 5. A recomendação (pergunta 6) fica para
 * a etapa seguinte: `onFinishQuestions` leva as respostas até ela.
 */
export function NewProjectWizard({
  initialName = '',
  onCancel,
  onSkip,
  onFinishQuestions,
}: NewProjectWizardProps) {
  const [name, setName] = useState(initialName)
  const [nameError, setNameError] = useState(false)
  const [draft, setDraft] = useState<WizardDraft>({})
  const [step, setStep] = useState<StepId>('name')
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const groupName = useId()
  const nameErrorId = useId()

  useFocusTrap(dialogRef)
  useRestoreFocus()

  // Foco inicial e a cada etapa: no nome, ou na opção escolhida (ou na primeira).
  useEffect(() => {
    const root = dialogRef.current
    if (!root) return
    const target =
      step === 'name'
        ? root.querySelector<HTMLInputElement>('input[type="text"]')
        : (root.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
          root.querySelector<HTMLInputElement>('input[type="radio"]'))
    target?.focus()
  }, [step])

  const trimmedName = name.trim()
  const isNameStep = step === 'name'
  const question = isNameStep || step === 'recommendation' ? null : questionById(step)
  const rows = railSteps(draft, step, name)
  const progress = progressPercent(draft, step)

  function showNameError() {
    setNameError(true)
    const input = dialogRef.current?.querySelector<HTMLInputElement>('input[type="text"]')
    input?.focus()
  }

  function goForward() {
    if (isNameStep && !trimmedName) {
      showNameError()
      return
    }
    const next = nextStep(draft, step)
    if (next === 'recommendation') {
      onFinishQuestions(trimmedName, toWizardAnswers(draft))
      return
    }
    setStep(next)
  }

  function goBack() {
    setStep(previousStep(draft, step))
  }

  function skip() {
    if (!trimmedName) {
      showNameError()
      return
    }
    onSkip(trimmedName)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key !== 'Enter') return
    const tag = (event.target as HTMLElement).tagName
    // Botões e links já têm o Enter próprio; campos e opções avançam.
    if (tag === 'BUTTON' || tag === 'A' || tag === 'TEXTAREA') return
    event.preventDefault()
    goForward()
  }

  const counter = question
    ? `Pergunta ${questionPosition(draft, question.id)} de ${totalSteps(draft)}`
    : 'Nome do projeto'

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <aside className={styles.rail} aria-label="Etapas do assistente">
          <div className={styles.railHeader}>
            <span className={styles.eyebrow}>Novo projeto</span>
            <span className={styles.railName}>{trimmedName || 'Sem nome ainda'}</span>
          </div>
          <ol className={styles.steps}>
            {rows.map((row) => (
              <li
                key={row.id}
                className={styles[row.state]}
                aria-current={row.state === 'current' ? 'step' : undefined}
              >
                <span className={styles.mark} aria-hidden="true">
                  {row.mark}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepLabel}>{row.label}</span>
                  <span className={styles.stepAnswer}>{row.answer}</span>
                </span>
              </li>
            ))}
          </ol>
          <span className={styles.spacer} />
          <p className={styles.railNote}>
            Menos de um minuto. Todas as perguntas são opcionais e nada aqui é definitivo.
          </p>
        </aside>

        <div className={styles.main}>
          <div className={styles.topBar}>
            <span className={styles.counter}>{counter}</span>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Progresso do assistente"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.spacer} />
            <button type="button" className={styles.skip} onClick={skip}>
              Pular e criar no modo Simples
            </button>
          </div>

          <div className={styles.body}>
            {isNameStep ? (
              <>
                <h2 id={titleId} className={styles.question}>
                  Qual é o nome do projeto?
                </h2>
                <p className={styles.hint}>É o único campo obrigatório. Você pode mudar depois.</p>
                <TextField
                  label="Nome do projeto"
                  value={name}
                  maxLength={120}
                  aria-invalid={nameError || undefined}
                  aria-describedby={nameError ? nameErrorId : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (nameError) setNameError(false)
                  }}
                />
                {nameError && (
                  <p id={nameErrorId} className={styles.error} role="alert">
                    {NAME_REQUIRED}
                  </p>
                )}
              </>
            ) : question ? (
              <>
                <h2 id={titleId} className={styles.question}>
                  {question.question}
                </h2>
                <p className={styles.hint}>{question.hint}</p>
                <fieldset className={styles.options}>
                  <legend className={styles.legend}>Escolha uma</legend>
                  {question.options.map((option, index) => {
                    const checked = draft[question.id] === option.value
                    const labelId = `${groupName}-${index}-label`
                    const hintId = `${groupName}-${index}-hint`
                    return (
                      <label
                        key={option.value}
                        className={checked ? styles.optionChecked : styles.option}
                      >
                        <input
                          type="radio"
                          className={styles.radio}
                          name={groupName}
                          value={option.value}
                          checked={checked}
                          aria-labelledby={labelId}
                          aria-describedby={option.hint ? hintId : undefined}
                          onChange={() => {
                            setDraft((current) => withAnswer(current, question.id, option.value))
                          }}
                        />
                        <span className={styles.optionText}>
                          <span id={labelId} className={styles.optionLabel}>
                            {option.label}
                          </span>
                          {option.hint && (
                            <span id={hintId} className={styles.optionHint}>
                              {option.hint}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </fieldset>
              </>
            ) : null}
          </div>

          <div className={styles.footer}>
            {isNameStep ? (
              <Button onClick={onCancel}>Cancelar</Button>
            ) : (
              <Button onClick={goBack}>Voltar</Button>
            )}
            <span className={styles.spacer} />
            {question && (
              <span className={styles.remaining}>
                {remainingLabel(remainingSteps(draft, question.id))}
              </span>
            )}
            <Button variant="primary" shortcut="Enter" onClick={goForward}>
              Continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
