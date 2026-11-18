import {
  MODULE_IDS,
  getManifest,
  getProjectPreset,
  planDisableModules,
  planEnableModules,
  projectPresetModules,
  recommendPreset,
  recommendationNote,
  recommendationSummary,
} from '@agilebox/core'
import type { GuideExperience, ModuleId, ProjectPresetKey, WizardAnswers } from '@agilebox/core'

/**
 * Estado da tela "Recomendação" do novo projeto (ADR-10). Função pura: não grava nada e não conhece
 * a tela. Ligar e desligar seguem as dependências do catálogo (`planEnableModules` e
 * `planDisableModules`); nenhum módulo do núcleo entra na lista.
 */

/**
 * Módulos que a tela Módulos mostra no design (`Modulos.dc.html`, 15 itens). Só deles se conta
 * "Os outros N ficam em Módulos". A tela do app ainda mostra também o grupo "Outros" (Agenda,
 * Impedimentos, Critérios, Subtarefas, Estimativa em pontos): divergência em pendências.
 */
const MODULES_SCREEN_IDS: readonly ModuleId[] = [
  'backlog',
  'wbs',
  'definitionOfDone',
  'risks',
  'sprints',
  'estimates.hours',
  'milestones',
  'schedule',
  'wip',
  'checkins',
  'cost',
  'reviewRetro',
  'burndown',
  'flowMetrics',
  'baseline',
]

/**
 * Ordem da lista "Vai ligar" no design: Backlog, Sprints, Estimativa, Custo, Cerimônias, Atualização
 * diária. O resto segue a ordem do catálogo. A Agenda não entra na lista: o design não a mostra, e
 * ela só vem junto porque as Cerimônias a exigem.
 */
const LIST_ORDER: readonly ModuleId[] = [
  'backlog',
  'sprints',
  'estimates.hours',
  'cost',
  'reviewRetro',
  'checkins',
]
const IMPLICIT_IDS: readonly ModuleId[] = ['agenda']

export interface RecommendationState {
  readonly name: string
  readonly answers: WizardAnswers
  readonly recommendedPreset: ProjectPresetKey
  /** Preset escolhido agora ("Outro ponto de partida"). Começa no recomendado. */
  readonly preset: ProjectPresetKey
  /** Módulos ligados, sem o núcleo, em ordem do catálogo. */
  readonly modules: readonly ModuleId[]
  /** Módulos desligados nesta tela (inclui os que saíram junto). Aparecem para religar. */
  readonly off: readonly ModuleId[]
  /** Motivos da recomendação. Módulo sem motivo mostra o objetivo do manifesto. */
  readonly reasons: Readonly<Partial<Record<ModuleId, string>>>
  readonly guideLevel: GuideExperience
  /** Aviso da última ligada ou desligada (dependência ou cascata), para a região de status. */
  readonly notice: string | null
}

export interface RecommendationResult {
  readonly modules: ModuleId[]
  readonly startedFromPreset: ProjectPresetKey
  readonly guideLevel: GuideExperience
  readonly answers: WizardAnswers
}

export interface ModuleRow {
  readonly id: ModuleId
  readonly name: string
  readonly level: 1 | 2 | 3 | null
  readonly reason: string
}

const NO_ACTIVE_SPRINT = { hasActiveSprint: false } as const

const GUIDE_BULLETS: Readonly<Record<GuideExperience, readonly string[]>> = {
  never: [
    'Primeiros passos abertos',
    'Telas vazias com explicação e exemplo',
    'Dicas de primeira vez',
  ],
  sometimes: [
    'Primeiros passos começam recolhidos',
    'Telas vazias com uma frase de explicação',
    'Sem dicas de primeira vez',
  ],
  always: [
    'Primeiros passos ocultos, abrem pelo ?',
    'Telas vazias com uma frase',
    'Sem dicas de primeira vez',
  ],
}

function catalogOrder(ids: Iterable<ModuleId>): ModuleId[] {
  return [...new Set(ids)].sort((a, b) => MODULE_IDS.indexOf(a) - MODULE_IDS.indexOf(b))
}

function withoutCore(ids: readonly ModuleId[]): ModuleId[] {
  return catalogOrder(ids.filter((id) => id !== 'core'))
}

function withCore(ids: readonly ModuleId[]): ModuleId[] {
  return catalogOrder(['core', ...ids])
}

function nameOf(id: ModuleId): string {
  return getManifest(id).name
}

function joinNames(ids: readonly ModuleId[]): string {
  const names = ids.map(nameOf)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

/** "Ligamos os dois" para dois módulos, "os três" para três, "todos" a partir daí. */
function togetherWord(count: number): string {
  if (count === 2) return 'os dois'
  if (count === 3) return 'os três'
  return 'todos'
}

/** Módulos que as respostas pedem além do preset (mesma regra de `recommendPreset`). */
function answerExtras(answers: WizardAnswers): ModuleId[] {
  const extras: ModuleId[] = []
  if (answers.outsiderFollows === 'yes') extras.push('milestones')
  if (answers.controlsHoursAndCost === 'yes') extras.push('estimates.hours', 'cost')
  return extras
}

/** Módulos de um preset escolhido à mão, com as dependências puxadas. Sem núcleo. Extras só com "Sempre". */
function presetModules(
  key: ProjectPresetKey,
  answers: WizardAnswers,
  guideLevel: GuideExperience,
): ModuleId[] {
  const base = projectPresetModules(key, { experienced: guideLevel === 'always' })
  const plan = planEnableModules(base, answerExtras(answers))
  if (!plan.ok) throw new Error(`Preset ${key} não fecha com as respostas`)
  return withoutCore(plan.enabled)
}

function reasonsFromRecommendation(
  recommendation: ReturnType<typeof recommendPreset>,
): Partial<Record<ModuleId, string>> {
  const reasons: Partial<Record<ModuleId, string>> = {}
  for (const reason of recommendation.reasons) reasons[reason.moduleId] = reason.text
  return reasons
}

/** Estado inicial: preset recomendado, módulos e motivos da recomendação, experiência das respostas. */
export function createRecommendationState(
  name: string,
  answers: WizardAnswers,
): RecommendationState {
  const recommendation = recommendPreset(answers)
  return {
    name,
    answers,
    recommendedPreset: recommendation.preset,
    preset: recommendation.preset,
    modules: withoutCore(recommendation.modules),
    off: [],
    reasons: reasonsFromRecommendation(recommendation),
    guideLevel: recommendation.guideLevel,
    notice: null,
  }
}

/** "Outro ponto de partida": recalcula módulos e motivos. Volta ao recomendado restaura a recomendação. */
export function choosePreset(
  state: RecommendationState,
  key: ProjectPresetKey,
): RecommendationState {
  if (key === state.recommendedPreset) {
    const recommendation = recommendPreset({ ...state.answers, experience: state.guideLevel })
    return {
      ...state,
      preset: key,
      modules: withoutCore(recommendation.modules),
      off: [],
      reasons: reasonsFromRecommendation(recommendation),
      notice: null,
    }
  }
  return {
    ...state,
    preset: key,
    modules: presetModules(key, state.answers, state.guideLevel),
    off: [],
    reasons: {},
    notice: null,
  }
}

/** Liga um módulo e puxa o que ele exige. Avisa quando outros entraram junto. */
export function enableModule(state: RecommendationState, id: ModuleId): RecommendationState {
  if (id === 'core' || state.modules.includes(id)) return state

  const plan = planEnableModules(withCore(state.modules), [id])
  if (!plan.ok) {
    const pair = plan.conflicts.find((item) => item.includes(id))
    const other = pair?.find((item) => item !== id)
    const notice = other
      ? `${nameOf(id)} não pode ficar ligado junto com ${nameOf(other)}.`
      : `${nameOf(id)} não pode ser ligado agora.`
    return { ...state, notice }
  }

  const modules = withoutCore(plan.enabled)
  const autoEnabled = plan.autoEnabled
  const notice =
    autoEnabled.length === 0
      ? null
      : `${nameOf(id)} precisa de ${joinNames(autoEnabled)}. Ligamos ${togetherWord(autoEnabled.length + 1)}.`

  return {
    ...state,
    modules,
    off: state.off.filter((item) => !modules.includes(item)),
    notice,
  }
}

/** Desliga um módulo e os que dependem dele. Nada é apagado: o módulo vai para "Desligados". */
export function disableModule(state: RecommendationState, id: ModuleId): RecommendationState {
  if (id === 'core' || !state.modules.includes(id)) return state

  const plan = planDisableModules(withCore(state.modules), [id], NO_ACTIVE_SPRINT)
  if (!plan.ok || plan.scheduled.length > 0) return state

  const disabled = plan.disableNow.filter((item) => item !== 'core')
  const cascade = plan.cascadeDisabled
  const notice =
    cascade.length === 0
      ? null
      : `Desligar ${nameOf(id)} também desliga ${joinNames(cascade)}, ${
          cascade.length === 1 ? 'que depende dele' : 'que dependem dele'
        }.`

  return {
    ...state,
    modules: withoutCore(plan.enabled),
    off: catalogOrder([...state.off, ...disabled]),
    notice,
  }
}

/**
 * Muda a experiência. Ela troca os bullets do guia e liga ou desliga os extras do preset
 * (`experiencedExtras`): só com "Sempre" entram na lista; com "Nunca" ou "Algumas vezes" saem e
 * viram só a nota (design `Recomendacao.dc.html`).
 */
export function changeExperience(
  state: RecommendationState,
  level: GuideExperience,
): RecommendationState {
  if (level === state.guideLevel) return state

  const extras = getProjectPreset(state.preset).experiencedExtras
  let modules = [...state.modules]
  let off = [...state.off]

  if (level !== 'always') {
    const onExtras = extras.filter((id) => modules.includes(id))
    const plan = planDisableModules(withCore(modules), onExtras, NO_ACTIVE_SPRINT)
    if (plan.ok && plan.scheduled.length === 0) modules = withoutCore(plan.enabled)
  } else {
    const plan = planEnableModules(withCore(modules), extras)
    if (plan.ok) {
      modules = withoutCore(plan.enabled)
      off = off.filter((id) => !modules.includes(id))
    }
  }

  return { ...state, guideLevel: level, modules, off, notice: null }
}

function listRank(id: ModuleId): number {
  const index = LIST_ORDER.indexOf(id)
  return index === -1 ? LIST_ORDER.length : index
}

function rowOf(state: RecommendationState, id: ModuleId): ModuleRow {
  const manifest = getManifest(id)
  return {
    id,
    name: manifest.name,
    level: manifest.level,
    reason: state.reasons[id] ?? manifest.objective,
  }
}

/**
 * Linhas da lista "Vai ligar" (ligados, na ordem do design) e "Desligados" (desligados nesta tela).
 * A Agenda vem junto por dependência e fica fora da lista.
 */
export function moduleRows(state: RecommendationState): { on: ModuleRow[]; off: ModuleRow[] } {
  const on = state.modules
    .filter((id) => !IMPLICIT_IDS.includes(id))
    .map((id, index) => ({ id, index }))
    .sort((a, b) => listRank(a.id) - listRank(b.id) || a.index - b.index)
    .map(({ id }) => rowOf(state, id))
  return { on, off: state.off.map((id) => rowOf(state, id)) }
}

/**
 * Extras de equipe experiente que não estão ligados nem desligados pela pessoa. Ficam só na nota
 * ("... entram quando a equipe já trabalha com ..."), fora da lista.
 */
export function hiddenExtras(state: RecommendationState): ModuleId[] {
  return getProjectPreset(state.preset).experiencedExtras.filter(
    (id) => !state.modules.includes(id) && !state.off.includes(id),
  )
}

/**
 * Módulos do catálogo da tela Módulos que não estão na lista, nem desligados, nem entre os extras
 * da nota. É o "Os outros N" e o "Ver todos".
 */
export function otherModules(state: RecommendationState): ModuleId[] {
  const extras = getProjectPreset(state.preset).experiencedExtras
  return MODULES_SCREEN_IDS.filter(
    (id) => !state.modules.includes(id) && !state.off.includes(id) && !extras.includes(id),
  )
}

/** Linhas do "Ver todos": os outros módulos, com o objetivo de cada um. Só leitura. */
export function otherModuleRows(state: RecommendationState): ModuleRow[] {
  return otherModules(state).map((id) => rowOf(state, id))
}

/** Nota abaixo da lista (texto do core): extras que ficaram fora e os outros módulos. */
export function recommendationNoteFor(state: RecommendationState): string | null {
  return recommendationNote({
    preset: state.preset,
    hiddenExtras: hiddenExtras(state),
    others: otherModules(state).length,
  })
}

/** Resumo do trabalho e do preset, mostrado sob o título. */
export function summaryFor(state: RecommendationState): string {
  return recommendationSummary(state.answers, state.preset)
}

/**
 * Rótulo do preset dividido em nome e método: "Ágil (Scrum)" vira "Ágil" e "Scrum". O design mostra o
 * método em destaque no título e fora do chip.
 */
export function presetTitleParts(label: string): { base: string; method: string | null } {
  const match = /^(.*?)\s*\((.+)\)$/.exec(label)
  if (!match) return { base: label, method: null }
  return { base: match[1] ?? label, method: match[2] ?? null }
}

/** Pergunta 6: cita o preset escolhido. */
export function experienceQuestion(preset: ProjectPresetKey): string {
  const method = getProjectPreset(preset).method
  return method ? `A equipe já trabalhou com ${method}?` : 'A equipe já organizou projetos assim?'
}

/** Os três bullets que descrevem a experiência escolhida. */
export function guideBullets(level: GuideExperience): readonly string[] {
  return GUIDE_BULLETS[level]
}

/** Resultado para criar o projeto. `modules` vai sem o núcleo: o backend o acrescenta. */
export function recommendationResult(state: RecommendationState): RecommendationResult {
  return {
    modules: [...state.modules],
    startedFromPreset: state.preset,
    guideLevel: state.guideLevel,
    answers: { ...state.answers, experience: state.guideLevel },
  }
}
