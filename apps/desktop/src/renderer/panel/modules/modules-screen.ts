import { getManifest, planDisableModules, planEnableModules } from '@agilebox/core'
import type { ModuleId, ProjectState } from '@agilebox/core'
import type { ProjectModuleDto } from '@agilebox/contract'

/**
 * Regras de exibição da tela "Módulos" do projeto. Não grava nada: a prévia usa as funções puras do
 * core (`planEnableModules`, `planDisableModules`) para mostrar o que entra e sai junto. O servidor
 * refaz a conta na gravação, então a prévia é só aviso.
 */

interface ModuleGroupSpec {
  readonly title: string
  readonly ids: readonly ModuleId[]
}

/** Grupos fixos da tela, na ordem do design. Núcleo e Plug-ins ficam de fora de propósito. */
export const MODULE_GROUPS: readonly ModuleGroupSpec[] = [
  { title: 'Escopo e qualidade', ids: ['backlog', 'wbs', 'definitionOfDone', 'risks'] },
  { title: 'Planejamento', ids: ['sprints', 'estimates.hours', 'milestones', 'schedule', 'wip'] },
  {
    title: 'Acompanhamento',
    ids: ['checkins', 'cost', 'reviewRetro', 'burndown', 'flowMetrics', 'baseline'],
  },
  {
    title: 'Outros',
    ids: ['agenda', 'impediments', 'acceptance', 'subtasks', 'estimates.points'],
  },
]

/** Ids listados na tela, sem núcleo e sem Plug-ins. */
export const LISTED_MODULE_IDS: readonly ModuleId[] = MODULE_GROUPS.flatMap((group) => group.ids)

export interface ModuleRow {
  readonly id: ModuleId
  /** Nome do manifesto, como aparece na interface. */
  readonly name: string
  /** "N1", "N2" ou "N3". */
  readonly levelTag: string
  /** Uma frase: por que o módulo existe (manifesto `objective`). */
  readonly objective: string
  /** Ligado ou em encerramento: os dois contam como ligados. */
  readonly enabled: boolean
  readonly windingDown: boolean
  readonly dependency: string
  /** Etiquetas de sinal: "Avançado" nos N3, "Em encerramento" quando encerrando. */
  readonly signals: readonly string[]
}

export interface ModuleGroupView {
  readonly title: string
  readonly rows: readonly ModuleRow[]
}

export interface ModulesSummary {
  readonly enabled: number
  readonly total: number
}

/** Lista de nomes separada por vírgula: "Sprints, Burndown e velocidade". Sem "e" final, para não confundir com nomes que já têm "e". */
export function joinNames(items: readonly string[]): string {
  return items.join(', ')
}

function nameOf(id: string): string {
  return getManifest(id as ModuleId).name
}

/** Nomes em pt-BR de uma lista de ids, unidos como frase ("Backlog e Sprints"). */
export function namesJoined(ids: readonly string[]): string {
  return joinNames(ids.map(nameOf))
}

/**
 * Texto de dependência: "Requer A, B", "Aproveita X", os dois juntos com " · " ou "Só o núcleo"
 * quando a única dependência é o próprio núcleo.
 */
export function dependencyText(module: Pick<ProjectModuleDto, 'requires' | 'enhances'>): string {
  const requires = module.requires.filter((id) => id !== 'core').map(nameOf)
  const enhances = module.enhances.map(nameOf)
  const parts: string[] = []
  if (requires.length > 0) parts.push(`Requer ${joinNames(requires)}`)
  if (enhances.length > 0) parts.push(`Aproveita ${joinNames(enhances)}`)
  return parts.length > 0 ? parts.join(' · ') : 'Só o núcleo'
}

function rowOf(module: ProjectModuleDto): ModuleRow {
  const windingDown = module.state === 'winding_down'
  const signals: string[] = []
  if (module.level === 3) signals.push('Avançado')
  if (windingDown) signals.push('Em encerramento')
  return {
    id: module.id as ModuleId,
    name: module.name,
    levelTag: module.level === null ? '' : `N${module.level}`,
    objective: module.objective,
    enabled: module.state !== 'disabled',
    windingDown,
    dependency: dependencyText(module),
    signals,
  }
}

/** Monta os grupos da tela. Módulo listado que não veio da API simplesmente não aparece. */
export function buildModuleGroups(modules: readonly ProjectModuleDto[]): ModuleGroupView[] {
  const byId = new Map(modules.map((module) => [module.id, module]))
  return MODULE_GROUPS.map((group) => ({
    title: group.title,
    rows: group.ids.flatMap((id) => {
      const module = byId.get(id)
      return module ? [rowOf(module)] : []
    }),
  }))
}

/** "N de M ligados", contando só os módulos listados (sem núcleo e sem Plug-ins). */
export function summarizeModules(modules: readonly ProjectModuleDto[]): ModulesSummary {
  const listed = modules.filter((module) =>
    (LISTED_MODULE_IDS as readonly string[]).includes(module.id),
  )
  return {
    enabled: listed.filter((module) => module.state !== 'disabled').length,
    total: listed.length,
  }
}

/** Ids que contam como ligados (ativos ou em encerramento), com o núcleo. */
export function enabledIdsOf(modules: readonly ProjectModuleDto[]): ModuleId[] {
  return [
    'core',
    ...modules
      .filter((module) => module.state !== 'disabled' && module.id !== 'core')
      .map((module) => module.id as ModuleId),
  ]
}

export interface TogglePreview {
  readonly kind: 'enable' | 'disable'
  /** Ligados junto por dependência (não o módulo pedido). */
  readonly alsoEnables: readonly string[]
  /** Desligados junto porque dependiam do módulo pedido. */
  readonly alsoDisables: readonly string[]
  /** Motivo da recusa em pt-BR; quando existe, nada deve ser gravado. */
  readonly refused?: string
}

function enableRefusal(
  moduleId: ModuleId,
  conflicts: readonly (readonly [ModuleId, ModuleId])[],
  reason: string,
): string {
  if (reason === 'conflict') {
    const others = [
      ...new Set(
        conflicts.map(([a, b]) => (a === moduleId ? b : a)).filter((id) => id !== moduleId),
      ),
    ]
    const names = joinNames(others.map(nameOf))
    return `Não dá para ligar ${nameOf(moduleId)} junto com ${names}: são ferramentas em conflito. Desligue ${names} antes.`
  }
  return 'Não foi possível ligar este módulo agora.'
}

function disableRefusal(reason: string): string {
  if (reason === 'core_required') return 'O Núcleo é obrigatório e não pode ser desligado.'
  if (reason === 'blocked_by_dependents')
    return 'Há módulos ativos que dependem deste. Desligue-os antes.'
  return 'Não foi possível desligar este módulo agora.'
}

/**
 * Prévia de ligar ou desligar um módulo, antes de gravar. `currentEnabled` são os ids que contam
 * como ligados (com `core`). `state` só muda o que a prévia recusa ou agenda; a tela não sabe da
 * sprint ativa, então o padrão é sem sprint ativa, e o servidor responde `scheduled` se houver.
 */
export function previewToggle(
  currentEnabled: readonly ModuleId[],
  moduleId: ModuleId,
  on: boolean,
  state: ProjectState = { hasActiveSprint: false },
): TogglePreview {
  if (on) {
    const plan = planEnableModules(currentEnabled, [moduleId])
    if (!plan.ok) {
      return {
        kind: 'enable',
        alsoEnables: [],
        alsoDisables: [],
        refused: enableRefusal(moduleId, plan.conflicts, plan.reason),
      }
    }
    return {
      kind: 'enable',
      alsoEnables: plan.autoEnabled.map(nameOf),
      alsoDisables: [],
    }
  }
  const plan = planDisableModules(currentEnabled, [moduleId], state)
  if (!plan.ok) {
    return {
      kind: 'disable',
      alsoEnables: [],
      alsoDisables: [],
      refused: disableRefusal(plan.reason),
    }
  }
  return {
    kind: 'disable',
    alsoEnables: [],
    alsoDisables: plan.cascadeDisabled.map(nameOf),
  }
}

/** Linhas de aviso da prévia, em pt-BR, antes do botão Confirmar. */
export function previewLines(moduleId: ModuleId, preview: TogglePreview): string[] {
  const name = nameOf(moduleId)
  if (preview.refused) return [preview.refused]
  if (preview.kind === 'enable') {
    return preview.alsoEnables.length > 0
      ? [`${name} precisa de ${joinNames(preview.alsoEnables)}. Ligamos junto?`]
      : []
  }
  const lines: string[] = []
  if (preview.alsoDisables.length > 0)
    lines.push(`Sai junto, porque depende de ${name}: ${joinNames(preview.alsoDisables)}.`)
  lines.push('Nada é apagado. Religar restaura os dados.')
  return lines
}

/** Aviso quando o servidor agenda o desligamento (ex.: Sprints com sprint ativa). Nada é agendado aqui. */
export function scheduledText(moduleId: string, reason: string): string {
  const name = nameOf(moduleId)
  if (reason === 'active_sprint')
    return `Não dá para desligar ${name} agora: há uma sprint ativa. Termine a sprint antes.`
  return `Não dá para desligar ${name} agora. Tente depois.`
}
