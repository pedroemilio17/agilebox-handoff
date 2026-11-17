import type { GuideStepDto, GuideViewDto, GuideWelcomeDto } from '@agilebox/contract'

export const GUIDE_PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

/** Trilha do preset Ágil, na ordem do guia. Títulos e textos são de exemplo para os testes. */
const STEPS: readonly Omit<GuideStepDto, 'done'>[] = [
  {
    key: 'backlog.list',
    title: 'Liste o que precisa ser feito',
    why: 'Sem lista, nada entra na sprint.',
    moduleId: 'backlog',
    moduleName: 'Backlog',
    next: 'Ordene pela importância',
    doneWhen: 'task.created',
  },
  {
    key: 'backlog.rank',
    title: 'Ordene pela importância',
    why: 'O que está no topo entra primeiro na sprint.',
    moduleId: 'backlog',
    moduleName: 'Backlog',
    next: 'Crie a primeira sprint',
    doneWhen: 'backlog.ranked',
  },
  {
    key: 'sprints.create',
    title: 'Crie a primeira sprint',
    why: 'A sprint é o intervalo de trabalho do time.',
    moduleId: 'sprints',
    moduleName: 'Sprints',
    next: 'Leve itens para a sprint',
    doneWhen: 'sprint.created',
  },
  {
    key: 'sprints.add',
    title: 'Leve itens para a sprint',
    why: 'Só o que está na sprint aparece no quadro.',
    moduleId: 'sprints',
    moduleName: 'Sprints',
    next: 'Atualize pela bandeja',
    doneWhen: 'sprint.itemAdded',
  },
  {
    key: 'daily.answer',
    title: 'Atualize pela bandeja',
    why: 'Uma linha por dia basta para o time se alinhar.',
    moduleId: 'checkins',
    moduleName: 'Diária',
    next: 'Estime os primeiros itens',
    doneWhen: 'daily.answered',
  },
  {
    key: 'estimate.first',
    title: 'Estime os primeiros itens',
    why: 'Horas mostram o tamanho do que vem.',
    moduleId: 'estimates.hours',
    moduleName: 'Estimativa',
    next: 'Marque a planning',
    doneWhen: 'task.estimated',
  },
  {
    key: 'ceremonies.planning',
    title: 'Marque a planning',
    why: 'A planning decide o que entra na sprint.',
    moduleId: 'reviewRetro',
    moduleName: 'Cerimônias',
    next: null,
    doneWhen: 'meeting.created',
  },
]

/** Guia com os primeiros `doneCount` passos feitos; o próximo vira o atual. */
export function makeGuide(
  options: {
    readonly doneCount?: number
    readonly firstStepsCard?: GuideViewDto['intensity']['firstStepsCard']
    readonly cardDismissed?: boolean
    readonly projectId?: string
    readonly showWelcome?: boolean
    readonly welcome?: GuideWelcomeDto | null
  } = {},
): GuideViewDto {
  const doneCount = options.doneCount ?? 1
  const trail = STEPS.map((step, index) => ({ ...step, done: index < doneCount }))
  return {
    projectId: options.projectId ?? GUIDE_PROJECT_ID,
    trail,
    done: doneCount,
    total: trail.length,
    currentKey: trail[doneCount]?.key ?? null,
    experience: 'sometimes',
    intensity: {
      firstStepsCard: options.firstStepsCard ?? 'open',
      emptyState: 'full',
      firstTimeHints: true,
      explainJargon: false,
    },
    cardDismissed: options.cardDismissed ?? false,
    showWelcome: options.showWelcome ?? false,
    welcome: options.welcome ?? null,
  }
}

/** Projeto criado pelo preset Ágil, com 5 módulos ligados. Exemplo para a janela de boas-vindas. */
export const WELCOME_AGIL: GuideWelcomeDto = {
  projectName: 'App de Chamados',
  presetKey: 'agil',
  presetLabel: 'Ágil',
  moduleCount: 5,
}
