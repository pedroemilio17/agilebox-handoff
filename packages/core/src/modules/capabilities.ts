import type { UserRole } from '../values/role'
import { isLevelAtLeast } from './levels'
import type { ExperienceLevel } from './levels'
import { getModule, MODULE_IDS } from './registry'
import type { ModuleId } from './registry'

/**
 * Tipos de capacidade que um módulo ativo pode gerar:
 * - `passive`: efeito passivo (ex.: "Sprint 4" no card). Vale em qualquer nível.
 * - `screen`: a tela ou entrada do módulo. Exige módulo ativo e nível da pessoa >= `minLevel`.
 * - `advanced_fields`: campos avançados do módulo. Mesma regra de `screen`; usada pela interface
 *   adaptativa (M2).
 */
export const MODULE_CAPABILITY_KINDS = ['passive', 'screen', 'advanced_fields'] as const

export type ModuleCapabilityKind = (typeof MODULE_CAPABILITY_KINDS)[number]

export type ModuleCapability = `${ModuleId}:${ModuleCapabilityKind}`

/** `tools:view`: ver quais ferramentas a equipe usa (todos). `tools:manage`: gerenciar ferramentas e nível (só gestor). */
export type ToolsCapability = 'tools:view' | 'tools:manage'

export type Capability = ModuleCapability | ToolsCapability

export interface CapabilityInput {
  /** Módulos ativos no time. Ids fora do catálogo são ignorados; `core` é sempre incluído. */
  modules: readonly ModuleId[]
  /** Nível de proficiência da pessoa. */
  level: ExperienceLevel
  role: UserRole
}

export interface ModuleLevelWarning {
  module: ModuleId
  requiredLevel: ExperienceLevel
}

function isKnownModule(id: string): id is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(id)
}

function moduleCapability(id: ModuleId, kind: ModuleCapabilityKind): ModuleCapability {
  return `${id}:${kind}`
}

/** Ordem de saída: módulos na ordem de `MODULE_IDS`, cada um com seus tipos, depois as ferramentas. */
const CAPABILITY_ORDER: readonly Capability[] = [
  ...MODULE_IDS.flatMap((id) => MODULE_CAPABILITY_KINDS.map((kind) => moduleCapability(id, kind))),
  'tools:view',
  'tools:manage',
]

/** Módulos ativos válidos: ids do catálogo, sem duplicatas, sempre com `core`, em ordem do catálogo. */
function activeModules(modules: readonly ModuleId[]): ModuleId[] {
  const active = new Set<ModuleId>(modules.filter(isKnownModule))
  active.add('core')
  return MODULE_IDS.filter((id) => active.has(id))
}

/**
 * Única resposta para "o que existe, aparece e é permitido, dentro de um time" na interface.
 * Função pura: não lê banco, relógio nem sessão. Não resolve dependências entre módulos: quem
 * chama passa o conjunto já resolvido (`resolveModuleSet`).
 */
export function effectiveCapabilities(input: CapabilityInput): Capability[] {
  const granted = new Set<Capability>()

  for (const id of activeModules(input.modules)) {
    granted.add(moduleCapability(id, 'passive'))
    if (isLevelAtLeast(input.level, getModule(id).minLevel)) {
      granted.add(moduleCapability(id, 'screen'))
      granted.add(moduleCapability(id, 'advanced_fields'))
    }
  }

  granted.add('tools:view')
  if (input.role === 'manager') {
    granted.add('tools:manage')
  }

  return CAPABILITY_ORDER.filter((capability) => granted.has(capability))
}

export function hasCapability(list: readonly Capability[], capability: Capability): boolean {
  return list.includes(capability)
}

/** Atalho: a tela do módulo aparece para esta pessoa neste time? */
export function shouldShowModuleScreen(input: CapabilityInput, moduleId: ModuleId): boolean {
  return hasCapability(effectiveCapabilities(input), moduleCapability(moduleId, 'screen'))
}

/**
 * Módulos ativos cujo nível mínimo está acima do nível do time. Base do aviso
 * "Sprints aparece a partir do Intermediário. Subir o nível do projeto?".
 */
export function moduleLevelWarning(
  input: Pick<CapabilityInput, 'modules' | 'level'>,
): ModuleLevelWarning[] {
  return activeModules(input.modules)
    .map((id) => ({ module: id, requiredLevel: getModule(id).minLevel }))
    .filter(({ requiredLevel }) => !isLevelAtLeast(input.level, requiredLevel))
}
