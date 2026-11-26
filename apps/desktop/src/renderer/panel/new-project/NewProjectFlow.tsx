import { useEffect, useState, type KeyboardEvent } from 'react'
import { NewProjectWizard } from './NewProjectWizard'
import { RecommendationScreen } from './RecommendationScreen'
import type { RecommendationResult } from './recommendation-state'
import { newProjectCopy } from './new-project-copy'
import { DEFAULT_WIZARD_DRAFT, type WizardDraft } from './wizard-steps'
import styles from './NewProject.module.css'

/**
 * Payload de criação. "Criar projeto simples agora" cria o projeto Simples, sem respostas nem
 * módulos. Pelas 3 perguntas e pela revisão, vem tudo o que a recomendação decidiu.
 */
export type NewProjectPayload =
  | { readonly name: string; readonly startedFromPreset: 'simples' }
  | ({ readonly name: string } & RecommendationResult)

export interface NewProjectFlowProps {
  readonly initialName?: string
  readonly submitting?: boolean
  readonly error?: string | null
  readonly onCancel: () => void
  readonly onCreate: (payload: NewProjectPayload) => void | Promise<void>
}

type Phase = 'name' | 'questions' | 'review'
const PHASE_INDEX: Record<Phase, number> = { name: 0, questions: 1, review: 2 }

/**
 * Novo projeto como página da área principal (design `revisao-ux/novo-projeto.html`): cabeçalho
 * com stepper "1. Nome · 2. Perguntas · 3. Revisão" e os três passos numa coluna de até 820px.
 */
export function NewProjectFlow({
  initialName = '',
  submitting = false,
  error = null,
  onCancel,
  onCreate,
}: NewProjectFlowProps) {
  const [phase, setPhase] = useState<Phase>('name')
  const [name, setName] = useState(initialName)
  // A descrição é só rascunho de tela: o contrato de criação ainda não a guarda.
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<WizardDraft>(DEFAULT_WIZARD_DRAFT)
  const [nameError, setNameError] = useState(false)
  /** Sobe a cada tentativa sem nome: devolve o foco ao campo mesmo com o erro já aberto. */
  const [nameFocusTick, setNameFocusTick] = useState(0)
  const trimmedName = name.trim()

  const [opener] = useState(() => document.activeElement)
  useEffect(
    () => () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    },
    [opener],
  )

  function requireName(): boolean {
    if (trimmedName) return true
    setNameError(true)
    setNameFocusTick((tick) => tick + 1)
    return false
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    onCancel()
  }

  return (
    <div className={styles.page} onKeyDown={onKeyDown}>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1 className={styles.pageTitle}>{newProjectCopy.title}</h1>
          <p className={styles.pageSub}>{newProjectCopy.subtitle}</p>
        </div>
        <div className={styles.pageHeadActions}>
          <ol className={styles.stepper} aria-label={newProjectCopy.stepperLabel}>
            {newProjectCopy.steps.map((label, index) => {
              const state =
                index === PHASE_INDEX[phase]
                  ? styles.stepPillActive
                  : index < PHASE_INDEX[phase]
                    ? styles.stepPillDone
                    : ''
              return (
                <li key={label} className={styles.stepItem}>
                  {index > 0 ? (
                    <span className={styles.stepSep} aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  <span
                    className={`${styles.stepPill} ${state}`}
                    aria-current={index === PHASE_INDEX[phase] ? 'step' : undefined}
                  >
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </header>

      <div className={styles.shell}>
        {error && phase !== 'review' ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {phase === 'review' ? (
          <RecommendationScreen
            name={trimmedName}
            draft={draft}
            submitting={submitting}
            error={error}
            onBack={() => setPhase('questions')}
            onCreate={(result) => {
              void onCreate({ name: trimmedName, ...result })
            }}
          />
        ) : (
          <NewProjectWizard
            phase={phase}
            name={name}
            description={description}
            draft={draft}
            nameError={nameError}
            nameFocusTick={nameFocusTick}
            submitting={submitting}
            onNameChange={(next) => {
              setName(next)
              if (next.trim()) setNameError(false)
            }}
            onDescriptionChange={setDescription}
            onDraftChange={setDraft}
            onExpress={() => {
              if (submitting || !requireName()) return
              void onCreate({ name: trimmedName, startedFromPreset: 'simples' })
            }}
            onGuided={() => {
              if (requireName()) setPhase('questions')
            }}
            onBackToName={() => setPhase('name')}
            onToReview={() => setPhase('review')}
          />
        )}
      </div>
    </div>
  )
}
