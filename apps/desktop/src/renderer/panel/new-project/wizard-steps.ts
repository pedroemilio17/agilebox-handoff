import type { GuideExperience, WizardAnswers } from '@agilebox/core'

/**
 * As 3 perguntas do fluxo guiado de novo projeto (`design/revisao-ux/novo-projeto.html`).
 * Função pura: não grava nada e converte o rascunho para `WizardAnswers` do domínio.
 */

export type DeliveryMode = 'continuo' | 'ciclos' | 'cronograma'
export type ExternalVisibility = 'sim' | 'nao'
export type TeamExperience = 'Iniciante' | 'Intermediário' | 'Experiente'

export type QuestionId = 'deliveryMode' | 'externalVisibility' | 'experience'

export interface WizardDraft {
  readonly deliveryMode: DeliveryMode
  readonly externalVisibility: ExternalVisibility
  readonly experience: TeamExperience
}

export const DEFAULT_WIZARD_DRAFT: WizardDraft = {
  deliveryMode: 'continuo',
  externalVisibility: 'nao',
  experience: 'Iniciante',
}

export interface WizardOption {
  readonly value: string
  readonly label: string
  readonly description: string
}

export interface WizardQuestion {
  readonly id: QuestionId
  readonly question: string
  readonly columns: 2 | 3
  readonly options: readonly WizardOption[]
}

export const WIZARD_QUESTIONS: readonly WizardQuestion[] = [
  {
    id: 'deliveryMode',
    question: 'Como o time prefere organizar as entregas?',
    columns: 3,
    options: [
      {
        value: 'continuo',
        label: 'Fluxo contínuo simples',
        description: 'Demandas entram no quadro e avançam conforme a equipe libera espaço.',
      },
      {
        value: 'ciclos',
        label: 'Ciclos curtos com metas',
        description:
          'Pacotes semanais ou quinzenais com fila priorizada e revisão ao fim do ciclo.',
      },
      {
        value: 'cronograma',
        label: 'Fases com cronograma e prazos fechados',
        description: 'Grandes entregas quebradas em datas definidas e acompanhamento de desvios.',
      },
    ],
  },
  {
    id: 'externalVisibility',
    question: 'Há clientes ou parceiros externos que precisam de previsibilidade?',
    columns: 2,
    options: [
      {
        value: 'sim',
        label: 'Sim, acompanhamos prazos com externos',
        description:
          'Ativa marcos de entrega e registro de pessoas externas (sem login nem avisos).',
      },
      {
        value: 'nao',
        label: 'Não, é um projeto interno da equipe',
        description: 'Mantém a navegação mais enxuta, focada apenas na execução diária do time.',
      },
    ],
  },
  {
    id: 'experience',
    question: 'Como você descreve a experiência da equipe com organização?',
    columns: 3,
    options: [
      {
        value: 'Iniciante',
        label: 'Iniciante',
        description: 'Kan aberto nos primeiros passos, dicas visíveis e explicação de termos.',
      },
      {
        value: 'Intermediário',
        label: 'Intermediário',
        description: 'Ajuda discreta quando alguém clicar em "?" e limites opcionais no quadro.',
      },
      {
        value: 'Experiente',
        label: 'Experiente',
        description: 'Interface limpa e silenciosa, mantendo apenas o atalho F1 se precisar.',
      },
    ],
  },
]

export function questionById(id: QuestionId): WizardQuestion {
  const question = WIZARD_QUESTIONS.find((item) => item.id === id)
  if (!question) throw new Error(`Pergunta desconhecida: ${id}`)
  return question
}

export function withAnswer(draft: WizardDraft, id: QuestionId, value: string): WizardDraft {
  const option = questionById(id).options.find((item) => item.value === value)
  if (!option) throw new Error(`Opção inválida para ${id}: ${value}`)
  return { ...draft, [id]: option.value }
}

export function toGuideExperience(experience: TeamExperience): GuideExperience {
  if (experience === 'Experiente') return 'always'
  if (experience === 'Intermediário') return 'sometimes'
  return 'never'
}

/** Converte o rascunho das 3 perguntas para `WizardAnswers` do domínio. */
export function toWizardAnswers(draft: WizardDraft): WizardAnswers {
  const outsiderFollows = draft.externalVisibility === 'sim' ? 'yes' : 'no'
  const experience = toGuideExperience(draft.experience)
  if (draft.deliveryMode === 'continuo') {
    return { workType: 'continuous', outsiderFollows, experience }
  }
  if (draft.deliveryMode === 'ciclos') {
    return {
      workType: 'finite',
      fixedDate: 'no',
      scope: 'will_change',
      outsiderFollows,
      experience,
    }
  }
  return {
    workType: 'finite',
    fixedDate: 'yes',
    scope: 'defined',
    outsiderFollows,
    experience,
  }
}
