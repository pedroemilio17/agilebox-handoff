import type { WizardAnswers } from '@agilebox/core'

/**
 * Perguntas do assistente de novo projeto (ADR-10), em ordem. Função pura: não grava nada e não
 * conhece a tela. "Não sei" nas perguntas 4 e 5 (que no domínio só aceitam sim ou não) fica no
 * rascunho e vira ausência de resposta ao sair do assistente.
 */

export type QuestionId =
  'workType' | 'fixedDate' | 'scope' | 'outsiderFollows' | 'controlsHoursAndCost'

export type StepId = 'name' | QuestionId | 'recommendation'

/** Respostas como o usuário as vê, incluindo "Não sei" nas perguntas 4 e 5. */
export interface WizardDraft {
  workType?: 'finite' | 'continuous' | 'unknown'
  fixedDate?: 'yes' | 'no' | 'unknown'
  scope?: 'defined' | 'partly' | 'will_change' | 'unknown'
  outsiderFollows?: 'yes' | 'no' | 'unknown'
  controlsHoursAndCost?: 'yes' | 'no' | 'unknown'
}

export interface WizardOption {
  readonly value: string
  readonly label: string
  /** Resumo que aparece no trilho de etapas. */
  readonly summary: string
  readonly hint?: string
}

export interface WizardQuestion {
  readonly id: QuestionId
  readonly railLabel: string
  readonly question: string
  readonly hint: string
  readonly options: readonly WizardOption[]
  /** Pergunta que não se aplica a trabalho contínuo. */
  readonly skippedWhenContinuous: boolean
}

const UNKNOWN_OPTION = { value: 'unknown', label: 'Não sei', summary: 'Não sei' } as const
const YES_NO_UNKNOWN_OPTIONS = [
  { value: 'yes', label: 'Sim', summary: 'Sim' },
  { value: 'no', label: 'Não', summary: 'Não' },
  UNKNOWN_OPTION,
] as const satisfies readonly WizardOption[]

export const WIZARD_QUESTIONS: readonly WizardQuestion[] = [
  {
    id: 'workType',
    railLabel: 'Tipo de trabalho',
    question: 'Esse trabalho tem começo e fim, ou é contínuo, com pedidos chegando sempre?',
    hint: 'Um trabalho com começo e fim é uma entrega. Um fluxo contínuo recebe pedidos o tempo todo.',
    skippedWhenContinuous: false,
    options: [
      { value: 'finite', label: 'Tem fim', summary: 'Tem começo e fim' },
      { value: 'continuous', label: 'Contínuo', summary: 'Contínuo, sem fim' },
      UNKNOWN_OPTION,
    ],
  },
  {
    id: 'fixedDate',
    railLabel: 'Data final',
    question: 'Existe uma data final que não pode mudar?',
    hint: 'Uma data fixa muda a forma de planejar o que cabe até ela.',
    skippedWhenContinuous: true,
    options: [
      { value: 'yes', label: 'Sim', summary: 'Data fixa' },
      { value: 'no', label: 'Não', summary: 'Sem data fixa' },
      UNKNOWN_OPTION,
    ],
  },
  {
    id: 'scope',
    railLabel: 'Entrega',
    question: 'O que vai ser entregue já está definido?',
    hint: 'Isso separa um plano fechado de um plano que se ajusta a cada ciclo.',
    skippedWhenContinuous: true,
    options: [
      {
        value: 'defined',
        label: 'Sim, está tudo definido',
        summary: 'Está definido',
        hint: 'Sabemos o que entregar do início ao fim.',
      },
      {
        value: 'partly',
        label: 'Em parte',
        summary: 'Em parte definido',
        hint: 'O principal está claro, os detalhes ainda não.',
      },
      {
        value: 'will_change',
        label: 'Vai mudar no caminho',
        summary: 'Vai mudar',
        hint: 'Vamos descobrir o que entregar enquanto trabalhamos.',
      },
      {
        value: 'unknown',
        label: 'Não sei',
        summary: 'Não sei',
        hint: 'Sem problema. Começamos simples e você ajusta depois.',
      },
    ],
  },
  {
    id: 'outsiderFollows',
    railLabel: 'Quem acompanha',
    question: 'Alguém de fora acompanha por entregas e datas?',
    hint: 'Se sim, os marcos ficam ligados para essa pessoa acompanhar.',
    skippedWhenContinuous: false,
    options: YES_NO_UNKNOWN_OPTIONS,
  },
  {
    id: 'controlsHoursAndCost',
    railLabel: 'Horas e custo',
    question: 'Vocês precisam controlar horas e custo?',
    hint: 'Se sim, as estimativas em horas e o custo ficam ligados.',
    skippedWhenContinuous: false,
    options: YES_NO_UNKNOWN_OPTIONS,
  },
]

const NOT_APPLICABLE = 'Não se aplica'

export function questionById(id: QuestionId): WizardQuestion {
  const question = WIZARD_QUESTIONS.find((item) => item.id === id)
  if (!question) throw new Error(`Pergunta desconhecida: ${id}`)
  return question
}

/** Perguntas que aparecem para este rascunho. Trabalho contínuo pula data e escopo. */
export function visibleSteps(draft: WizardDraft): readonly WizardQuestion[] {
  const continuous = draft.workType === 'continuous'
  return WIZARD_QUESTIONS.filter((question) => !(continuous && question.skippedWhenContinuous))
}

/** Todas as etapas do fluxo na ordem, com o nome antes e a recomendação (6ª) depois. */
export function stepOrder(draft: WizardDraft): StepId[] {
  return ['name', ...visibleSteps(draft).map((question) => question.id), 'recommendation']
}

/** Total exibido em "Pergunta N de T": as perguntas visíveis mais a da recomendação. */
export function totalSteps(draft: WizardDraft): number {
  return visibleSteps(draft).length + 1
}

/** Número (1 a T) de uma pergunta neste fluxo; 0 se não for pergunta visível. */
export function questionPosition(draft: WizardDraft, id: QuestionId): number {
  const index = visibleSteps(draft).findIndex((question) => question.id === id)
  return index === -1 ? 0 : index + 1
}

/** Perguntas que faltam depois desta, contando a da recomendação. */
export function remainingSteps(draft: WizardDraft, id: QuestionId): number {
  return totalSteps(draft) - questionPosition(draft, id)
}

export function remainingLabel(count: number): string {
  return count === 1 ? 'Falta 1 pergunta' : `Faltam ${count} perguntas`
}

/** Progresso de 0 a 100. A metade do passo atual conta, para a barra mostrar que se está nele. */
export function progressPercent(draft: WizardDraft, step: StepId): number {
  if (step === 'name') return 0
  if (step === 'recommendation') return 100
  const position = questionPosition(draft, step)
  if (position === 0) return 0
  return Math.round(((position - 0.5) / totalSteps(draft)) * 100)
}

/** Próxima etapa. Depois da última pergunta visível, devolve `recommendation`. */
export function nextStep(draft: WizardDraft, step: StepId): StepId {
  const order = stepOrder(draft)
  const index = order.indexOf(step)
  return order[index + 1] ?? step
}

/** Etapa anterior. Na primeira pergunta, volta ao nome; no nome, fica nele. */
export function previousStep(draft: WizardDraft, step: StepId): StepId {
  const order = stepOrder(draft)
  const index = order.indexOf(step)
  return index <= 1 ? 'name' : (order[index - 1] ?? 'name')
}

/** Registra uma resposta. O valor precisa ser uma das opções da pergunta. */
export function withAnswer(draft: WizardDraft, id: QuestionId, value: string): WizardDraft {
  const option = questionById(id).options.find((item) => item.value === value)
  if (!option) throw new Error(`Opção inválida para ${id}: ${value}`)
  return { ...draft, [id]: option.value }
}

/** Converte o rascunho para `WizardAnswers` do domínio: sem respostas de perguntas puladas. */
export function toWizardAnswers(draft: WizardDraft): WizardAnswers {
  const visible = new Set(visibleSteps(draft).map((question) => question.id))
  const answers: WizardAnswers = {}
  if (visible.has('workType') && draft.workType) answers.workType = draft.workType
  if (visible.has('fixedDate') && draft.fixedDate) answers.fixedDate = draft.fixedDate
  if (visible.has('scope') && draft.scope) answers.scope = draft.scope
  if (draft.outsiderFollows && draft.outsiderFollows !== 'unknown') {
    answers.outsiderFollows = draft.outsiderFollows
  }
  if (draft.controlsHoursAndCost && draft.controlsHoursAndCost !== 'unknown') {
    answers.controlsHoursAndCost = draft.controlsHoursAndCost
  }
  return answers
}

export interface RailRow {
  readonly id: StepId
  readonly label: string
  readonly state: 'done' | 'current' | 'todo' | 'skipped'
  /** Marca do círculo: ✓, número da pergunta, "—" para pulada ou "•" para o nome. */
  readonly mark: string
  readonly answer: string
}

/**
 * Linhas do trilho de etapas. Etapas antes da atual aparecem como feitas; sem resposta, dizem
 * "Não sei" (o usuário passou por elas). Perguntas puladas dizem "Não se aplica".
 */
export function railSteps(draft: WizardDraft, current: StepId, name: string): RailRow[] {
  // Trilho lista todas as perguntas, inclusive as puladas, para o usuário ver o caminho escolhido.
  const order: StepId[] = [
    'name',
    ...WIZARD_QUESTIONS.map((question) => question.id),
    'recommendation',
  ]
  const currentIndex = order.indexOf(current)
  const visible = visibleSteps(draft)
  const rows: RailRow[] = []

  order.forEach((id, index) => {
    const passed = index < currentIndex
    const state: RailRow['state'] = index === currentIndex ? 'current' : passed ? 'done' : 'todo'

    if (id === 'name') {
      const trimmed = name.trim()
      rows.push({
        id,
        label: 'Nome',
        state,
        mark: passed ? '✓' : '•',
        answer: trimmed,
      })
      return
    }

    if (id === 'recommendation') {
      rows.push({
        id,
        label: 'Recomendação',
        state,
        mark: String(visible.length + 1),
        answer: '',
      })
      return
    }

    const question = questionById(id)
    if (!visible.includes(question)) {
      rows.push({
        id,
        label: question.railLabel,
        state: 'skipped',
        mark: '—',
        answer: NOT_APPLICABLE,
      })
      return
    }

    const value = draft[id]
    const option = question.options.find((item) => item.value === value)
    const answer = option?.summary ?? (passed ? 'Não sei' : '')
    const number = questionPosition(draft, id)
    rows.push({
      id,
      label: question.railLabel,
      state,
      mark: passed ? '✓' : String(number),
      answer,
    })
  })

  return rows
}
