import { ValidationError } from '../shared/errors'
import { planEnableModules } from './project-modules'
import { getProjectPreset, projectPresetModules } from './project-presets'
import type { ProjectPreset, ProjectPresetKey } from './project-presets'
import { getModule, MODULE_LABELS } from './registry'
import type { ModuleId } from './registry'

/**
 * Assistente de criação de projeto (ADR-10). Função pura: recebe as respostas (ausente = pulou) e
 * devolve o preset recomendado, os módulos ligados e um motivo por módulo. Não grava nada; quem
 * cria o projeto aplica o resultado. Metodologia é dado (`project-presets.ts`), não código.
 */

export interface WizardAnswers {
  workType?: 'finite' | 'continuous' | 'unknown'
  fixedDate?: 'yes' | 'no' | 'unknown'
  scope?: 'defined' | 'partly' | 'will_change' | 'unknown'
  outsiderFollows?: 'yes' | 'no'
  controlsHoursAndCost?: 'yes' | 'no'
  experience?: 'never' | 'sometimes' | 'always'
}

export interface WizardRecommendation {
  readonly preset: ProjectPresetKey
  /** Conjunto final, em ordem do catálogo, com `core` e com as dependências puxadas. */
  readonly modules: ModuleId[]
  /** Um motivo em pt-BR para cada módulo ligado, exceto `core`. */
  readonly reasons: { moduleId: ModuleId; text: string }[]
  /** Espelha a experiência informada; `never` quando pulou. */
  readonly guideLevel: 'never' | 'sometimes' | 'always'
}

type NonCoreModuleId = Exclude<ModuleId, 'core'>

interface ModuleText {
  /** Concorda com o rótulo do módulo: "ligado", "ligada", "ligados", "ligadas". */
  readonly participle: string
  /** Pronome do módulo quando outro módulo precisa dele: "dele", "dela", "deles", "delas". */
  readonly pronoun: string
  /** Por que o módulo existe, em uma oração que segue "porque". */
  readonly clause: string
}

const MODULE_TEXT: Readonly<Record<NonCoreModuleId, ModuleText>> = {
  agenda: {
    participle: 'ligada',
    pronoun: 'dela',
    clause: 'a equipe marca reuniões e compromissos',
  },
  backlog: {
    participle: 'ligado',
    pronoun: 'dele',
    clause: 'é preciso guardar e ordenar o que ainda não entrou em sprint',
  },
  sprints: {
    participle: 'ligadas',
    pronoun: 'delas',
    clause: 'o trabalho é planejado em ciclos curtos',
  },
  checkins: { participle: 'ligados', pronoun: 'deles', clause: 'a equipe faz atualização diária' },
  impediments: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'impedimentos precisam aparecer para serem resolvidos',
  },
  'estimates.hours': {
    participle: 'ligadas',
    pronoun: 'delas',
    clause: 'o trabalho é dimensionado em horas',
  },
  'estimates.points': {
    participle: 'ligadas',
    pronoun: 'delas',
    clause: 'o trabalho é dimensionado em pontos',
  },
  acceptance: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'cada tarefa precisa de critérios claros de aceite',
  },
  wip: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'o trabalho em andamento precisa de limite',
  },
  subtasks: {
    participle: 'ligadas',
    pronoun: 'delas',
    clause: 'tarefas grandes se dividem em partes com dependências',
  },
  integrations: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'a equipe quer avisos de outras ferramentas',
  },
  flowMetrics: {
    participle: 'ligadas',
    pronoun: 'delas',
    clause: 'é preciso medir o fluxo de trabalho',
  },
  reviewRetro: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'cada sprint fecha com revisão e retrospectiva',
  },
  burndown: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'o ritmo da sprint precisa ficar visível',
  },
  cost: {
    participle: 'ligado',
    pronoun: 'dele',
    clause: 'é preciso somar o valor das horas de cada tarefa',
  },
  milestones: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'há marcos a cumprir ao longo do projeto',
  },
  wbs: { participle: 'ligadas', pronoun: 'delas', clause: 'o projeto se divide em entregas' },
  schedule: { participle: 'ligado', pronoun: 'dele', clause: 'há uma data final fixa' },
  definitionOfDone: {
    participle: 'ligado',
    pronoun: 'dele',
    clause: 'é preciso combinar quando uma tarefa está pronta',
  },
  baseline: {
    participle: 'ligada',
    pronoun: 'dela',
    clause: 'é preciso comparar o plano com o que foi executado',
  },
  risks: {
    participle: 'ligados',
    pronoun: 'deles',
    clause: 'é preciso acompanhar o que pode atrasar o projeto',
  },
}

function choosePreset(answers: WizardAnswers): ProjectPresetKey {
  if (answers.workType === 'continuous') return 'kanban'
  if (answers.workType !== 'finite') return 'simples'

  if (answers.fixedDate === 'yes') {
    if (answers.scope === 'defined') return 'tradicional'
    if (answers.scope === 'partly' || answers.scope === 'will_change') return 'hibrido'
    return 'simples'
  }

  if (answers.fixedDate === 'no') {
    if (
      answers.scope === 'defined' ||
      answers.scope === 'partly' ||
      answers.scope === 'will_change'
    ) {
      return 'agil'
    }
    return 'simples'
  }

  return 'simples'
}

/** Módulos que as respostas pedem além do preset, com o trecho de motivo de cada um. */
function answerClauses(answers: WizardAnswers): Map<ModuleId, string> {
  const clauses = new Map<ModuleId, string>()
  if (answers.outsiderFollows === 'yes') {
    clauses.set('milestones', 'quem está de fora acompanha o projeto')
  }
  if (answers.controlsHoursAndCost === 'yes') {
    clauses.set('estimates.hours', 'você controla horas e custo')
    clauses.set('cost', 'você controla horas e custo')
  }
  return clauses
}

function requiresModule(dependent: ModuleId, required: ModuleId): boolean {
  const definition = getModule(dependent)
  return (
    definition.requires.includes(required) ||
    (definition.requiresAnyOf ?? []).some((alternative) => alternative.includes(required))
  )
}

interface ReasonContext {
  readonly preset: ProjectPreset
  readonly experienced: boolean
  readonly answers: ReadonlyMap<ModuleId, string>
  readonly enabled: readonly ModuleId[]
}

/** Ordem de prioridade: resposta do wizard, depois o preset, depois a experiência, depois a dependência. */
function reasonFor(moduleId: NonCoreModuleId, context: ReasonContext): string {
  const text = MODULE_TEXT[moduleId]
  const head = `${MODULE_LABELS[moduleId]} ${text.participle}`

  const answerClause = context.answers.get(moduleId)
  if (answerClause) return `${head} porque ${answerClause}`

  if (context.preset.modules.includes(moduleId)) return `${head} porque ${text.clause}`

  if (context.experienced && context.preset.experiencedExtras.includes(moduleId)) {
    return `${head} porque a equipe é experiente`
  }

  const dependent = context.enabled.find((other) => requiresModule(other, moduleId))
  if (dependent) {
    return `${head} porque ${MODULE_LABELS[dependent]} precisa ${text.pronoun}`
  }

  return `${head} porque ${text.clause}`
}

/**
 * Recomenda um preset e os módulos ligados a partir das respostas do wizard (ADR-10).
 * Mesma entrada, mesma saída.
 */
export function recommendPreset(answers: WizardAnswers): WizardRecommendation {
  const preset = getProjectPreset(choosePreset(answers))
  const experienced = answers.experience === 'sometimes' || answers.experience === 'always'
  const clauses = answerClauses(answers)

  const plan = planEnableModules(projectPresetModules(preset.key, { experienced }), [
    ...clauses.keys(),
  ])
  if (!plan.ok) throw new ValidationError('Recomendação de projeto inválida')

  const enabled = plan.enabled
  const isNonCore = (id: ModuleId): id is NonCoreModuleId => id !== 'core'
  const context: ReasonContext = { preset, experienced, answers: clauses, enabled }

  return {
    preset: preset.key,
    modules: enabled,
    reasons: enabled.filter(isNonCore).map((moduleId) => ({
      moduleId,
      text: reasonFor(moduleId, context),
    })),
    guideLevel: answers.experience ?? 'never',
  }
}
