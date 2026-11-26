import { MODULE_IDS, getManifest, planDisableModules, planEnableModules } from '@agilebox/core'
import type { GuideExperience, ModuleId, ProjectPresetKey, WizardAnswers } from '@agilebox/core'
import { toGuideExperience, toWizardAnswers, type WizardDraft } from './wizard-steps'

/**
 * Estado da revisão final do novo projeto (`design/revisao-ux/novo-projeto.html`, Passo 3).
 * Mapeia os 8 recursos do protótipo para módulos reais do `@agilebox/core`, respeitando
 * dependências (`planEnableModules` / `planDisableModules`).
 */

export type FeatureKey =
  'quadro' | 'wip' | 'daily' | 'dod' | 'backlog' | 'sprints' | 'entregas' | 'cronograma'

export interface FeatureSpec {
  readonly key: FeatureKey
  readonly label: string
  readonly description: string
  readonly locked: boolean
  readonly primaryModule: ModuleId
  readonly extraModules: readonly ModuleId[]
}

export const FEATURES_CATALOG: readonly FeatureSpec[] = [
  {
    key: 'quadro',
    label: 'Quadro nos 5 estados',
    description: 'Planejamento, A fazer, Desenvolvendo, Revisar e Concluído.',
    locked: true,
    primaryModule: 'core',
    extraModules: [],
  },
  {
    key: 'wip',
    label: 'Limite simultâneo no Quadro',
    description: 'Alerta quando muitas tarefas começam ao mesmo tempo.',
    locked: false,
    primaryModule: 'wip',
    extraModules: [],
  },
  {
    key: 'daily',
    label: 'Atualização diária (Bandeja)',
    description: 'Check-in rápido de fim de dia sem interromper o trabalho.',
    locked: false,
    primaryModule: 'checkins',
    extraModules: [],
  },
  {
    key: 'dod',
    label: 'Checklist de conclusão',
    description: 'Conferência rápida antes de finalizar uma tarefa.',
    locked: false,
    primaryModule: 'definitionOfDone',
    extraModules: [],
  },
  {
    key: 'backlog',
    label: 'Backlog',
    description: 'Fila priorizada das próximas tarefas antes de entrar no quadro.',
    locked: false,
    primaryModule: 'backlog',
    extraModules: [],
  },
  {
    key: 'sprints',
    label: 'Sprints (Ciclos curtos)',
    description: 'Organize pacotes semanais ou quinzenais com meta.',
    locked: false,
    primaryModule: 'sprints',
    extraModules: [],
  },
  {
    key: 'entregas',
    label: 'Entregas e Riscos',
    description: 'Divida resultados maiores e monitore riscos em matriz 3×3.',
    locked: false,
    primaryModule: 'wbs',
    extraModules: ['risks'],
  },
  {
    key: 'cronograma',
    label: 'Cronograma e Marcos',
    description: 'Linha do tempo com dependências simples e datas-chave.',
    locked: false,
    primaryModule: 'schedule',
    extraModules: ['milestones'],
  },
]

export interface FeatureRow {
  readonly key: FeatureKey
  readonly label: string
  readonly description: string
  readonly locked: boolean
  readonly on: boolean
}

export interface RecommendationState {
  readonly name: string
  readonly draft: WizardDraft
  readonly preset: ProjectPresetKey
  readonly presetBadge: string
  readonly summary: string
  readonly guideLevel: GuideExperience
  /** Módulos ligados (sem `core`), em ordem do catálogo. */
  readonly modules: readonly ModuleId[]
  readonly notice: string | null
}

export interface RecommendationResult {
  readonly modules: ModuleId[]
  readonly startedFromPreset: ProjectPresetKey
  readonly guideLevel: GuideExperience
  readonly answers: WizardAnswers
}

const NO_ACTIVE_SPRINT = { hasActiveSprint: false } as const

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

function presetFor(draft: WizardDraft): { preset: ProjectPresetKey; badge: string } {
  if (draft.deliveryMode === 'ciclos' && draft.externalVisibility === 'sim') {
    return { preset: 'hibrido', badge: 'Ciclos + Marcos com Cliente' }
  }
  if (draft.deliveryMode === 'ciclos') {
    return { preset: 'agil', badge: 'Ciclos Ágeis (Sprints)' }
  }
  if (draft.deliveryMode === 'cronograma') {
    return { preset: 'tradicional', badge: 'Fases com Cronograma' }
  }
  return { preset: 'kanban', badge: 'Fluxo Contínuo' }
}

function summaryForDraft(draft: WizardDraft): string {
  const visibility =
    draft.externalVisibility === 'sim'
      ? ' · com visibilidade para clientes e parceiros.'
      : ' · uso interno da equipe.'
  return `Apoio do Kan configurado para perfil ${draft.experience}${visibility}`
}

function initialModulesFor(draft: WizardDraft): ModuleId[] {
  const requested: ModuleId[] = []
  if (draft.deliveryMode === 'continuo') requested.push('wip')
  if (draft.experience !== 'Experiente') requested.push('checkins')
  if (draft.externalVisibility === 'sim' || draft.deliveryMode !== 'continuo') {
    requested.push('definitionOfDone')
  }
  if (draft.deliveryMode === 'ciclos') requested.push('backlog', 'sprints')
  if (draft.deliveryMode === 'cronograma' || draft.externalVisibility === 'sim') {
    requested.push('wbs', 'risks', 'schedule', 'milestones')
  }
  const plan = planEnableModules(['core'], requested)
  return plan.ok ? withoutCore(plan.enabled) : withoutCore(requested)
}

export function createRecommendationState(name: string, draft: WizardDraft): RecommendationState {
  const { preset, badge } = presetFor(draft)
  return {
    name,
    draft,
    preset,
    presetBadge: badge,
    summary: summaryForDraft(draft),
    guideLevel: toGuideExperience(draft.experience),
    modules: initialModulesFor(draft),
    notice: null,
  }
}

export function featureRows(state: RecommendationState): FeatureRow[] {
  return FEATURES_CATALOG.map((feature) => ({
    key: feature.key,
    label: feature.label,
    description: feature.description,
    locked: feature.locked,
    on: feature.locked || state.modules.includes(feature.primaryModule),
  }))
}

export function toggleFeature(
  state: RecommendationState,
  key: FeatureKey,
  on: boolean,
): RecommendationState {
  const spec = FEATURES_CATALOG.find((item) => item.key === key)
  if (!spec || spec.locked) return state

  const targetIds: ModuleId[] = [spec.primaryModule, ...spec.extraModules]

  if (on) {
    const plan = planEnableModules(withCore(state.modules), targetIds)
    if (!plan.ok) {
      return { ...state, notice: `${spec.label} não pode ser ligado agora.` }
    }
    const auto = plan.autoEnabled.filter((id) => !targetIds.includes(id))
    const notice =
      auto.length > 0 ? `${spec.label} precisa de ${joinNames(auto)}. Ligado junto.` : null
    return { ...state, modules: withoutCore(plan.enabled), notice }
  }

  const currentlyOn = targetIds.filter((id) => state.modules.includes(id))
  if (currentlyOn.length === 0) return state
  const plan = planDisableModules(withCore(state.modules), currentlyOn, NO_ACTIVE_SPRINT)
  if (!plan.ok || plan.scheduled.length > 0) return state

  const cascade = plan.cascadeDisabled.filter((id) => !targetIds.includes(id))
  const notice =
    cascade.length > 0
      ? `Desligar ${spec.label} também desliga ${joinNames(cascade)}, que ${
          cascade.length === 1 ? 'depende' : 'dependem'
        } dele.`
      : null
  return { ...state, modules: withoutCore(plan.enabled), notice }
}

/** Resultado enviado para criar o projeto. `modules` vai sem o núcleo. */
export function recommendationResult(state: RecommendationState): RecommendationResult {
  return {
    modules: [...state.modules],
    startedFromPreset: state.preset,
    guideLevel: state.guideLevel,
    answers: toWizardAnswers(state.draft),
  }
}
