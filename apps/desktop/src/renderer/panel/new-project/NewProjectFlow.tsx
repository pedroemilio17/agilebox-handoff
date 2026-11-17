import { useState } from 'react'
import type { WizardAnswers } from '@agilebox/core'
import { NewProjectWizard } from './NewProjectWizard'
import { RecommendationScreen } from './RecommendationScreen'
import type { RecommendationResult } from './recommendation-state'
import { visibleSteps, type QuestionId, type WizardDraft } from './wizard-steps'

/**
 * Payload de criação. Pular cria o projeto Simples, sem respostas nem módulos (ADR-10). Pelas
 * perguntas e pela recomendação, vem tudo o que a recomendação decidiu.
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

type Phase = 'questions' | 'recommendation'

/**
 * Assistente de novo projeto de ponta a ponta: perguntas, depois a recomendação. Voltar da
 * recomendação reabre a última pergunta com as respostas preservadas. Não fala com o main: quem
 * chama decide como criar.
 */
export function NewProjectFlow({
  initialName = '',
  submitting = false,
  error = null,
  onCancel,
  onCreate,
}: NewProjectFlowProps) {
  const [phase, setPhase] = useState<Phase>('questions')
  const [name, setName] = useState(initialName)
  const [draft, setDraft] = useState<WizardDraft>({})
  const [answers, setAnswers] = useState<WizardAnswers>({})
  const [resumeAt, setResumeAt] = useState<QuestionId | undefined>(undefined)

  if (phase === 'recommendation') {
    return (
      <RecommendationScreen
        name={name}
        answers={answers}
        submitting={submitting}
        error={error}
        onBack={() => setPhase('questions')}
        onCancel={onCancel}
        onCreate={(result) => {
          void onCreate({ name, ...result })
        }}
      />
    )
  }

  return (
    <NewProjectWizard
      initialName={name}
      initialDraft={draft}
      {...(resumeAt === undefined ? {} : { resumeAt })}
      onCancel={onCancel}
      onSkip={(skippedName) => {
        void onCreate({ name: skippedName, startedFromPreset: 'simples' })
      }}
      onFinishQuestions={(finishedName, finishedAnswers, finishedDraft) => {
        const last = visibleSteps(finishedDraft).at(-1)
        setName(finishedName)
        setDraft(finishedDraft)
        setAnswers(finishedAnswers)
        setResumeAt(last?.id)
        setPhase('recommendation')
      }}
    />
  )
}
