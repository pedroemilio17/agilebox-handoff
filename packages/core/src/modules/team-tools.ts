import { ValidationError } from '../shared/errors'
import type { OrganizationId, UserId } from '../shared/ids'
import { EXPERIENCE_LEVELS } from './levels'
import type { ExperienceLevel } from './levels'
import { getModule, MODULE_IDS } from './registry'
import type { ModuleId } from './registry'
import { resolveModuleSet } from './resolve'
import { TEAM_PRESETS } from './presets'
import type { TeamPresetId } from './presets'

/**
 * Estado de uma ferramenta dentro do time (PLANO-2.0, "Mudar ferramentas sem quebrar o que está
 * em andamento"):
 * - `active`: existe e aceita itens novos.
 * - `winding_down`: em encerramento. Conta como "existe" para a regra de dependência e para o
 *   conjunto ativo (`toActiveModuleIds`), mas só aceita o que já existe: essa restrição é decidida
 *   em `moduleUseRefusal` e aplicada pelo guard de módulo da application.
 * - `disabled`: desligado. Os dados seguem guardados e voltam ao reativar.
 */
export const MODULE_STATES = ['active', 'winding_down', 'disabled'] as const
export type ModuleState = (typeof MODULE_STATES)[number]

/** Valor JSON simples: texto, número finito, booleano, nulo, lista ou objeto de valores JSON. */
export type TeamJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly TeamJsonValue[]
  | { readonly [key: string]: TeamJsonValue }

/** Configuração opcional de um módulo: sempre um objeto JSON simples. */
export type TeamModuleConfig = { readonly [key: string]: TeamJsonValue }

/**
 * Uma linha de `team_modules`: como a ferramenta está para a equipe.
 * `changedBy` e `changedAt` são `null` quando a linha veio do padrão de código ou da migração
 * (ninguém a gravou ainda).
 */
export interface TeamModuleSetting {
  readonly organizationId: OrganizationId
  readonly moduleId: ModuleId
  readonly state: ModuleState
  readonly config?: TeamModuleConfig
  readonly changedBy: UserId | null
  readonly changedAt: string | null
}

/** Ajustes da equipe lidos do banco: nível da equipe e todas as ferramentas com linha gravada. */
export interface TeamToolsSettings {
  readonly level: ExperienceLevel
  /** Em ordem do catálogo. Ferramenta sem linha conta como `disabled`. */
  readonly modules: readonly TeamModuleSetting[]
}

/** Pedido de gravação de um módulo. Só os campos da escolha: a autoria é carimbada ao gravar. */
export interface TeamModuleUpdate {
  readonly moduleId: ModuleId
  readonly state: ModuleState
  readonly config?: TeamModuleConfig
}

/**
 * Pedido de gravação. `modules` pode ser parcial: linhas não citadas ficam como estavam
 * (desligar é gravar `disabled`; nada é apagado, "desativar esconde, nunca apaga").
 */
export interface TeamToolsUpdate {
  readonly level: ExperienceLevel
  readonly modules: readonly TeamModuleUpdate[]
  /** Quando presente, a gravação é uma aplicação de preset e fica na auditoria como `preset`. */
  readonly preset?: TeamPresetId
}

export const TEAM_TOOLS_AUDIT_KINDS = ['module_state', 'level', 'preset', 'config'] as const
export type TeamToolsAuditKind = (typeof TEAM_TOOLS_AUDIT_KINDS)[number]

/**
 * Diferença entre dois ajustes. `before`/`after` de estado são o estado efetivo: ferramenta sem linha
 * conta como `disabled`. `preset` registra a aplicação de um preset (uma entrada por gravação).
 * `config` guarda a configuração antes e depois em JSON canônico (`canonicalConfigJson`); `null` é o padrão.
 */
export type TeamToolsChange =
  | { kind: 'module_state'; moduleId: ModuleId; before: ModuleState; after: ModuleState }
  | { kind: 'level'; before: ExperienceLevel; after: ExperienceLevel }
  | { kind: 'preset'; presetId: TeamPresetId }
  | { kind: 'config'; moduleId: ModuleId; before: string | null; after: string | null }

/**
 * Forma canônica da configuração de um módulo, para comparar e para auditar: chaves em ordem e
 * `null` quando não há configuração (ausente ou sem chaves, que volta ao padrão).
 */
export function canonicalConfigJson(config: TeamModuleConfig | undefined): string | null {
  if (config === undefined) return null
  const keys = Object.keys(config).sort()
  if (keys.length === 0) return null
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, config[key]])))
}

/** Linha de `team_tools_audit` já com os dados de negócio; o id é atribuído pela persistência. */
export interface TeamToolsAuditRecord {
  readonly organizationId: OrganizationId
  readonly actorId: UserId
  readonly kind: TeamToolsAuditKind
  readonly moduleId: ModuleId | null
  readonly before: string | null
  readonly after: string | null
  readonly createdAt: string
}

export interface TeamToolsAuditEntry extends TeamToolsAuditRecord {
  readonly id: number
}

export function toModuleState(value: string): ModuleState {
  if (!(MODULE_STATES as readonly string[]).includes(value))
    throw new ValidationError('Estado de ferramenta inválido')
  return value as ModuleState
}

export function toExperienceLevel(value: string): ExperienceLevel {
  if (!(EXPERIENCE_LEVELS as readonly string[]).includes(value))
    throw new ValidationError('Nível da equipe inválido')
  return value as ExperienceLevel
}

export function toModuleId(value: string): ModuleId {
  getModule(value as ModuleId)
  return value as ModuleId
}

export function toTeamToolsAuditKind(value: string): TeamToolsAuditKind {
  if (!(TEAM_TOOLS_AUDIT_KINDS as readonly string[]).includes(value))
    throw new ValidationError('Tipo de auditoria inválido')
  return value as TeamToolsAuditKind
}

function isJsonValue(value: unknown): value is TeamJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value) as unknown
    return (
      (prototype === Object.prototype || prototype === null) &&
      Object.values(value).every(isJsonValue)
    )
  }
  return false
}

/** Configuração vinda de fora (pedido ou banco): só objeto JSON simples passa. */
export function toTeamModuleConfig(value: unknown): TeamModuleConfig {
  return validateConfig(value)
}

function validateConfig(config: unknown): TeamModuleConfig {
  if (
    typeof config !== 'object' ||
    config === null ||
    Array.isArray(config) ||
    !isJsonValue(config)
  )
    throw new ValidationError('Configuração da ferramenta deve ser um objeto JSON simples')
  return config as TeamModuleConfig
}

function catalogOrder<T extends { readonly moduleId: ModuleId }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => MODULE_IDS.indexOf(a.moduleId) - MODULE_IDS.indexOf(b.moduleId))
}

/** Ferramentas que existem para o time: `active` e `winding_down`, em ordem do catálogo, sem repetição. */
export function toActiveModuleIds(
  modules: readonly Pick<TeamModuleSetting, 'moduleId' | 'state'>[],
): ModuleId[] {
  const ids = new Set<ModuleId>(
    modules.filter((module) => module.state !== 'disabled').map((module) => module.moduleId),
  )
  return MODULE_IDS.filter((id) => ids.has(id))
}

/** Estado efetivo de um módulo para o time: ferramenta sem linha gravada conta como `disabled`. */
export function moduleStateOf(
  modules: readonly Pick<TeamModuleSetting, 'moduleId' | 'state'>[],
  moduleId: ModuleId,
): ModuleState {
  return modules.find((module) => module.moduleId === moduleId)?.state ?? 'disabled'
}

/** Motivo pelo qual um caso de uso de módulo não pode rodar agora. */
export type ModuleUseRefusal = 'module_disabled' | 'module_winding_down'

/**
 * Decide se um caso de uso de módulo pode rodar, dado o estado do módulo (PLANO-2.0, regra 6 e
 * "Mudar ferramentas sem quebrar o que está em andamento"):
 * - `disabled`: recusa tudo, leitura inclusive.
 * - `winding_down`: só o que já existe. Recusa o que cria itens novos; leitura e edição passam.
 * - `active`: tudo passa.
 * O núcleo nunca passa por aqui: quem chama decide isso.
 */
export function moduleUseRefusal(
  state: ModuleState,
  use: { readonly creates: boolean },
): ModuleUseRefusal | null {
  if (state === 'disabled') return 'module_disabled'
  if (state === 'winding_down' && use.creates) return 'module_winding_down'
  return null
}

/**
 * Valida o conjunto de ferramentas com o resolvedor de dependências: o núcleo precisa estar
 * `active`, não pode haver conflito entre ferramentas que existem e nenhuma pode depender de
 * uma ferramenta que não existe. Lança `ValidationError` quando o conjunto é inválido.
 */
export function validateTeamModuleSet(
  modules: readonly Pick<TeamModuleSetting, 'moduleId' | 'state'>[],
): void {
  const core = modules.find((module) => module.moduleId === 'core')
  if (core?.state !== 'active') throw new ValidationError('O Núcleo precisa estar ativo')

  const active = toActiveModuleIds(modules)
  const resolution = resolveModuleSet([], { enable: active })
  if (!resolution.ok) {
    if (resolution.reason === 'conflict') {
      const pairs = resolution.conflicts.map(([a, b]) => `${a} e ${b}`).join(', ')
      throw new ValidationError(`Ferramentas em conflito ativas juntas: ${pairs}`)
    }
    throw new ValidationError('Conjunto de ferramentas inválido')
  }
  if (resolution.autoEnabled.length > 0) {
    throw new ValidationError(
      `Ferramenta exigida por outra ativa não está ligada: ${resolution.autoEnabled.join(', ')}`,
    )
  }
}

/**
 * Valida e normaliza os ajustes lidos ou prestes a ser gravados: nível conhecido, sem módulo
 * repetido, conjunto válido, em ordem do catálogo.
 */
export function createTeamToolsSettings(input: TeamToolsSettings): TeamToolsSettings {
  toExperienceLevel(input.level)
  const seen = new Set<ModuleId>()
  for (const module of input.modules) {
    getModule(module.moduleId)
    toModuleState(module.state)
    if (module.config !== undefined) validateConfig(module.config)
    if (seen.has(module.moduleId)) throw new ValidationError('Ferramenta repetida no time')
    seen.add(module.moduleId)
  }
  validateTeamModuleSet(input.modules)
  return { level: input.level, modules: catalogOrder(input.modules) }
}

/** Preset como pedido de gravação: todas as ferramentas do preset `active`, no nível sugerido. */
export function teamToolsUpdateFromPreset(presetId: TeamPresetId): TeamToolsUpdate {
  const preset = TEAM_PRESETS.find((candidate) => candidate.id === presetId)
  if (!preset) throw new ValidationError('Preset desconhecido')
  return {
    level: preset.suggestedLevel,
    modules: preset.modules.map((moduleId) => ({ moduleId, state: 'active' as const })),
  }
}

/**
 * Padrão transitório para a organização sem linhas gravadas: o catálogo de antes do ADR-10 (lista
 * fixa, para os módulos novos nascerem desligados), exceto `estimates.points` (conflita com `estimates.hours`; ADR-07) e `integrations` (plug-ins estão fora
 * do MVP). Nível Avançado. Existe para preservar o que já funciona hoje (WIP, subtarefas, métricas
 * de fluxo, retro e burndown aparecem para todos). Vale até a equipe escolher um preset; a migração
 * 0012 grava esta mesma lista para as organizações que já existiam.
 */
export const DEFAULT_TEAM_MODULE_IDS: readonly ModuleId[] = Object.freeze([
  'core',
  'agenda',
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'acceptance',
  'wip',
  'subtasks',
  'flowMetrics',
  'reviewRetro',
  'burndown',
])
export const DEFAULT_TEAM_LEVEL: ExperienceLevel = 'advanced'

export function defaultTeamTools(organizationId: OrganizationId): TeamToolsSettings {
  return {
    level: DEFAULT_TEAM_LEVEL,
    modules: DEFAULT_TEAM_MODULE_IDS.map((moduleId) => ({
      organizationId,
      moduleId,
      state: 'active' as const,
      changedBy: null,
      changedAt: null,
    })),
  }
}

/**
 * Aplica um pedido de gravação sobre os ajustes atuais, sem efeitos colaterais.
 *
 * - Valida nível, módulos e configuração do pedido e o conjunto resultante (`createTeamToolsSettings`).
 *   Conjunto inválido é recusado antes de qualquer escrita.
 * - Config omitida no pedido fica como estava (mudar só o estado não apaga a configuração); config
 *   informada substitui a anterior, e objeto vazio volta ao padrão.
 * - Carimba `changedBy`/`changedAt` só nas linhas que mudaram; as demais mantêm a autoria anterior.
 * - Devolve as diferenças de estado efetivo, de nível, de preset e de configuração, que viram a
 *   auditoria. Config igual não gera diferença.
 */
export function applyTeamToolsUpdate(
  current: TeamToolsSettings,
  update: TeamToolsUpdate,
  stamp: { readonly organizationId: OrganizationId; readonly actorId: UserId; readonly at: string },
): { settings: TeamToolsSettings; changes: TeamToolsChange[] } {
  toExperienceLevel(update.level)
  if (update.preset !== undefined && !TEAM_PRESETS.some((preset) => preset.id === update.preset))
    throw new ValidationError('Preset desconhecido')
  const requested = new Set<ModuleId>()
  for (const module of update.modules) {
    getModule(module.moduleId)
    toModuleState(module.state)
    if (module.config !== undefined) validateConfig(module.config)
    if (requested.has(module.moduleId)) throw new ValidationError('Ferramenta repetida no pedido')
    requested.add(module.moduleId)
  }

  const changes: TeamToolsChange[] = []
  if (update.level !== current.level) {
    changes.push({ kind: 'level', before: current.level, after: update.level })
  }
  if (update.preset !== undefined) {
    changes.push({ kind: 'preset', presetId: update.preset })
  }

  const written: TeamModuleSetting[] = []
  for (const requestedModule of update.modules) {
    const previous = current.modules.find((module) => module.moduleId === requestedModule.moduleId)
    const before = previous?.state ?? 'disabled'
    const config = requestedModule.config ?? previous?.config
    const configBefore = canonicalConfigJson(previous?.config)
    const configAfter = canonicalConfigJson(config)
    const stateChanged = before !== requestedModule.state
    const configChanged = configBefore !== configAfter
    if (stateChanged) {
      changes.push({
        kind: 'module_state',
        moduleId: requestedModule.moduleId,
        before,
        after: requestedModule.state,
      })
    }
    if (configChanged) {
      changes.push({
        kind: 'config',
        moduleId: requestedModule.moduleId,
        before: configBefore,
        after: configAfter,
      })
    }
    const changed = stateChanged || configChanged
    written.push({
      organizationId: stamp.organizationId,
      moduleId: requestedModule.moduleId,
      state: requestedModule.state,
      ...(config !== undefined ? { config } : {}),
      changedBy: changed ? stamp.actorId : (previous?.changedBy ?? null),
      changedAt: changed ? stamp.at : (previous?.changedAt ?? null),
    })
  }

  const merged = new Map<ModuleId, TeamModuleSetting>(
    current.modules.map((module) => [module.moduleId, module]),
  )
  for (const row of written) merged.set(row.moduleId, row)

  const settings = createTeamToolsSettings({
    level: update.level,
    modules: [...merged.values()],
  })
  return { settings, changes: orderChanges(changes) }
}

type ModuleChange = Extract<TeamToolsChange, { readonly moduleId: ModuleId }>

function isModuleChange(change: TeamToolsChange): change is ModuleChange {
  return change.kind === 'module_state' || change.kind === 'config'
}

function orderChanges(changes: TeamToolsChange[]): TeamToolsChange[] {
  const presets = changes.filter((change) => change.kind === 'preset')
  const levels = changes.filter((change) => change.kind === 'level')
  const modules = changes
    .filter(isModuleChange)
    .sort((a, b) => MODULE_IDS.indexOf(a.moduleId) - MODULE_IDS.indexOf(b.moduleId))
  return [...presets, ...levels, ...modules]
}

/**
 * Converte as diferenças em registros de auditoria da organização e do ator. A persistência só
 * acrescenta esses registros; quem grava decide o id.
 */
export function auditRecordsFor(
  changes: readonly TeamToolsChange[],
  stamp: { readonly organizationId: OrganizationId; readonly actorId: UserId; readonly at: string },
): TeamToolsAuditRecord[] {
  const base = { organizationId: stamp.organizationId, actorId: stamp.actorId, createdAt: stamp.at }
  return changes.map((change): TeamToolsAuditRecord => {
    switch (change.kind) {
      case 'level':
        return {
          ...base,
          kind: 'level',
          moduleId: null,
          before: change.before,
          after: change.after,
        }
      case 'preset':
        return { ...base, kind: 'preset', moduleId: null, before: null, after: change.presetId }
      case 'module_state':
        return {
          ...base,
          kind: 'module_state',
          moduleId: change.moduleId,
          before: change.before,
          after: change.after,
        }
      case 'config':
        return {
          ...base,
          kind: 'config',
          moduleId: change.moduleId,
          before: change.before,
          after: change.after,
        }
    }
  })
}
