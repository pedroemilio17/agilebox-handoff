import { ValidationError } from '../shared/errors'
import { planEnableModules } from './project-modules'
import { getProjectPreset, projectPresetModules } from './project-presets'
import type { ProjectPresetKey } from './project-presets'
import { moduleShortLabel } from './registry'
import type { ModuleId } from './registry'

/**
 * Assistente de criação de projeto (ADR-10). Função pura: recebe as respostas (ausente = pulou) e
 * devolve o preset recomendado, os módulos ligados e um motivo por módulo. Não grava nada; quem
 * cria o projeto aplica o resultado. Metodologia é dado (`project-presets.ts`), não código.
 *
 * Os textos seguem o design `Recomendacao.dc.html`: uma frase por módulo e um resumo do trabalho.
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

interface ReasonInput {
  readonly preset: ProjectPresetKey
  readonly answers: WizardAnswers
  /** Módulos ligados no resultado, com `core`. */
  readonly enabled: readonly ModuleId[]
}

/** Um motivo por módulo: uma frase. Quando a resposta muda o texto, a função olha as respostas. */
const REASON: Readonly<Record<NonCoreModuleId, (input: ReasonInput) => string>> = {
  agenda: () => 'A Agenda guarda as reuniões e os compromissos da equipe.',
  backlog: ({ answers }) => {
    if (answers.scope === 'will_change') {
      return 'A entrega vai mudar, então o trabalho precisa de uma fila em ordem.'
    }
    if (answers.scope === 'partly') {
      return 'Parte do escopo vai mudar, então o trabalho precisa de uma fila em ordem.'
    }
    return 'O trabalho precisa de uma fila em ordem antes de entrar em sprint.'
  },
  sprints: ({ preset }) =>
    preset === 'hibrido'
      ? 'Ciclos curtos com meta para tratar os detalhes que mudam dentro da data fixa.'
      : 'Ciclos curtos com meta para ajustar o rumo sem data fixa.',
  checkins: () => 'Mantém o quadro em dia pela bandeja, sem reunião diária.',
  impediments: () => 'Mostra o que bloqueia a equipe, até ser resolvido.',
  'estimates.hours': ({ answers, enabled }) => {
    const withSprints = enabled.includes('sprints')
    if (answers.controlsHoursAndCost === 'yes' && withSprints) {
      return 'Você quer controlar horas, e as sprints usam horas para a capacidade.'
    }
    if (answers.controlsHoursAndCost === 'yes') return 'Você quer controlar horas de cada tarefa.'
    if (withSprints) {
      return 'As sprints usam horas para a capacidade, então cada tarefa ganha uma estimativa.'
    }
    return 'Cada tarefa ganha uma estimativa de horas para planejar o prazo.'
  },
  'estimates.points': () => 'Mede o trabalho em pontos, em vez de horas.',
  acceptance: () => 'Cada tarefa tem critérios claros para ser aceita.',
  wip: () => 'Avisa quando há tarefas demais em andamento.',
  subtasks: () => 'Divide tarefas grandes em partes, com dependências entre elas.',
  integrations: () => 'Avisa quando outras ferramentas mudam algo do projeto.',
  flowMetrics: () =>
    'Mostra quanto tempo as tarefas levam do início ao fim e quantas terminam por semana.',
  reviewRetro: () => 'Planning, review e retro entram na Agenda no ritmo das sprints.',
  burndown: () => 'Mostra se a sprint vai fechar.',
  cost: () => 'Você quer controlar custo: horas × valor/hora de cada pessoa.',
  milestones: () => 'Mostra as datas que importam para quem está de fora.',
  wbs: () => 'Divide o escopo em entregas menores.',
  schedule: () =>
    'Há uma data final que não pode mudar, então o trabalho precisa de um cronograma.',
  definitionOfDone: () => 'Combina o que conta como concluído antes de a tarefa ir para Concluído.',
  baseline: () => 'Compara o planejado com o que foi executado.',
  risks: () => 'Antecipa o que pode dar errado.',
}

/** Frase de fechamento do resumo, uma por preset (mesmo tom e tamanho do design). */
const CLOSING: Readonly<Record<ProjectPresetKey, string>> = {
  simples: 'Nada para configurar agora: o projeto começa simples e você ajusta depois.',
  kanban:
    'O quadro mostra o fluxo do dia a dia, e o limite de tarefas em andamento evita gargalos.',
  agil: 'Ciclos curtos deixam a equipe ajustar o rumo a cada duas semanas.',
  tradicional: 'Marcos e cronograma mostram o caminho até a data final, passo a passo.',
  hibrido: 'Os marcos seguram a data, e as partes que mudam andam em sprints curtas.',
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

/** Módulos que as respostas pedem além do preset. */
function answerExtras(answers: WizardAnswers): ModuleId[] {
  const extras: ModuleId[] = []
  if (answers.outsiderFollows === 'yes') extras.push('milestones')
  if (answers.controlsHoursAndCost === 'yes') extras.push('estimates.hours', 'cost')
  return extras
}

/** "A, B e C": a última união vira " e ". */
function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/**
 * Resumo da recomendação: uma frase com o trabalho (tipo, data e escopo, só o que foi respondido)
 * e o fechamento do preset escolhido. Com as respostas de `Recomendacao.dc.html` sai exatamente o
 * texto do design.
 */
export function recommendationSummary(answers: WizardAnswers, preset: ProjectPresetKey): string {
  const parts: string[] = []
  if (answers.workType === 'finite') parts.push('com começo e fim')
  else if (answers.workType === 'continuous') parts.push('sem começo e fim')
  if (answers.fixedDate === 'yes') parts.push('com data fixa')
  else if (answers.fixedDate === 'no') parts.push('sem data fixa')
  if (answers.scope === 'defined') parts.push('com escopo definido')
  else if (answers.scope === 'partly') parts.push('com parte do escopo definida')
  else if (answers.scope === 'will_change') parts.push('com entrega que vai mudar')

  const opening = parts.length > 0 ? `Trabalho ${joinWithAnd(parts)}.` : null
  return [opening, CLOSING[preset]].filter((sentence) => sentence !== null).join(' ')
}

/**
 * Nota abaixo da lista "Vai ligar": os extras de equipe experiente que ficaram fora (só com
 * "Sempre" eles entram) e quantos módulos do catálogo ficam em Módulos. Nulo quando não há nada a dizer.
 */
export function recommendationNote(input: {
  readonly preset: ProjectPresetKey
  readonly hiddenExtras: readonly ModuleId[]
  readonly others: number
}): string | null {
  const sentences: string[] = []
  if (input.hiddenExtras.length > 0) {
    const names = joinWithAnd(input.hiddenExtras.map((id) => moduleShortLabel(id)))
    const verb = input.hiddenExtras.length === 1 ? 'entra' : 'entram'
    const method = getProjectPreset(input.preset).method
    const context = method
      ? `quando a equipe já trabalha com ${method}`
      : 'quando a equipe já organizou projetos assim'
    sentences.push(`${names} ${verb} ${context}.`)
  }
  if (input.others === 1) sentences.push('O outro módulo fica em Módulos.')
  else if (input.others > 1) sentences.push(`Os outros ${input.others} ficam em Módulos.`)
  return sentences.length > 0 ? sentences.join(' ') : null
}

/**
 * Recomenda um preset e os módulos ligados a partir das respostas do wizard (ADR-10).
 * Mesma entrada, mesma saída. Os extras de nível 3 entram só com experiência "Sempre".
 */
export function recommendPreset(answers: WizardAnswers): WizardRecommendation {
  const preset = getProjectPreset(choosePreset(answers))
  const experienced = answers.experience === 'always'

  const plan = planEnableModules(
    projectPresetModules(preset.key, { experienced }),
    answerExtras(answers),
  )
  if (!plan.ok) throw new ValidationError('Recomendação de projeto inválida')

  const enabled = plan.enabled
  const reasons: { moduleId: ModuleId; text: string }[] = []
  for (const moduleId of enabled) {
    if (moduleId === 'core') continue
    reasons.push({
      moduleId,
      text: REASON[moduleId]({ preset: preset.key, answers, enabled }),
    })
  }

  return {
    preset: preset.key,
    modules: enabled,
    reasons,
    guideLevel: answers.experience ?? 'never',
  }
}
