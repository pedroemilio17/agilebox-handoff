import { createContext, useContext } from 'react'
import { getModule, isLevelAtLeast, MODULE_IDS } from '@agilebox/core'
import type { Capability, ExperienceLevel, ModuleId, ModuleState } from '@agilebox/core'

/**
 * Leitura das capacidades para a interface. A regra de acesso continua no backend: aqui só se
 * decide o que aparece. Tudo que não chega como capacidade fica escondido.
 *
 * Visibilidade de módulo (ADR-10):
 * - Com um projeto selecionado, vale o estado do módulo nesse projeto (`projectModules.get`).
 * - Sem projeto, vale a regra da organização (`projectModules.getOrganization`); sem projeto ativo
 *   na organização, vale a equipe (`teamTools.get`).
 * - O nível de experiência não esconde tela: `showScreen` ignora o nível. Já campos avançados
 *   seguem o nível (`advanced_fields`).
 */
export interface Capabilities {
  /** Falso enquanto a lista não chegou (carregando ou com erro): nesse caso tudo aparece. */
  readonly known: boolean
  /** A lista ainda está sendo pedida. Não busca dados de módulo antes de saber se ele existe. */
  readonly loading: boolean
  can(capability: Capability): boolean
  /**
   * A tela do módulo aparece: o módulo está ligado ou encerrando no escopo atual (projeto, ou
   * organização/equipe quando não há projeto). O nível não entra aqui.
   */
  showScreen(moduleId: ModuleId): boolean
  /** Pode pedir os dados de uma ferramenta: só depois de a lista chegar, para não pedir o que o backend recusa. */
  canFetch(capability: Capability): boolean
  /**
   * Ferramenta em encerramento (`winding_down`): o que já existe segue visível e editável, mas
   * não se cria nada novo. Vem do estado do módulo no projeto (ou na organização), sem regra paralela.
   */
  isWindingDown(moduleId: ModuleId): boolean
}

/** Estado de cada módulo no escopo atual. Módulo fora da lista conta como desligado. */
export type ModuleStates = Readonly<Partial<Record<ModuleId, ModuleState>>>

/**
 * Padrão seguro para carregamento e erro: trata tudo como permitido, para não piscar nem esconder o
 * que existe. Se o módulo estiver desligado, o backend recusa a chamada de qualquer forma.
 */
export const ALLOW_ALL: Capabilities = {
  known: false,
  loading: false,
  can: () => true,
  showScreen: () => true,
  canFetch: () => true,
  isWindingDown: () => false,
}

/** Converte a lista de módulos de um projeto ou da organização no mapa de estados. */
export function moduleStatesOf(
  modules: readonly { readonly id: string; readonly state: ModuleState }[],
): ModuleStates {
  return Object.fromEntries(modules.map((module) => [module.id, module.state]))
}

/** Partes de uma capacidade de módulo (`impediments:screen`); `null` para ferramentas (`tools:view`). */
function moduleCapabilityParts(
  capability: string,
): { readonly moduleId: string; readonly kind: string } | null {
  const separator = capability.indexOf(':')
  if (separator < 0) return null
  const kind = capability.slice(separator + 1)
  if (kind !== 'screen' && kind !== 'passive' && kind !== 'advanced_fields') return null
  return { moduleId: capability.slice(0, separator), kind }
}

/** Estado de carregamento: permissivo para a tela, sem pedir dados de módulo. */
function loadingCapabilities(windingDown: (moduleId: ModuleId) => boolean): Capabilities {
  return {
    known: false,
    loading: true,
    can: () => true,
    showScreen: () => true,
    canFetch: () => false,
    isWindingDown: windingDown,
  }
}

/** Escopo de módulos de uma leitura: o projeto selecionado, ou a organização sem projeto. */
export interface ModuleScope {
  readonly modules: ModuleStates
  /** Nível da equipe. Só ações e campos avançados seguem o nível; a tela não (ADR-10). */
  readonly level: ExperienceLevel
}

/**
 * Monta a leitura a partir das capacidades da equipe (`granted`) e, quando há, do escopo de módulos
 * (`scope`: o projeto selecionado, ou a organização). Com escopo:
 * - tela (`showScreen`) vale se o módulo está ligado ou encerrando, sem o nível (ADR-10);
 * - `m:screen` em `can` (e em `canFetch`) e `m:advanced_fields` seguem o nível, para ações e cartões;
 * - `m:passive` vale em qualquer nível (efeito passivo, como no domínio);
 * - ferramentas (`tools:*`) seguem a lista da equipe.
 * Sem escopo, a tela aparece com o efeito passivo ou a própria tela na lista, também sem o nível;
 * `can` segue a lista literal.
 *
 * `undefined` em `granted` (sem dados ainda) vira `ALLOW_ALL`, ou o estado de carregamento
 * quando `loading` é verdadeiro.
 */
export function buildCapabilities(
  granted: readonly string[] | undefined,
  loading = false,
  windingDown: readonly string[] = [],
  scope?: ModuleScope,
): Capabilities {
  const windingSet = new Set<string>(windingDown)
  const isWindingDown = (moduleId: ModuleId) =>
    scope === undefined ? windingSet.has(moduleId) : scope.modules[moduleId] === 'winding_down'
  if (granted === undefined) {
    return loading ? loadingCapabilities(isWindingDown) : ALLOW_ALL
  }

  const set = new Set<string>(granted)
  const teamHas = (capability: string) => set.has(capability)
  // Módulo ligado ou encerrando no escopo (o núcleo sempre). Sem escopo, não se usa aqui.
  const stateVisible = (moduleId: string): boolean => {
    if (moduleId === 'core') return true
    const state = scope?.modules[moduleId as ModuleId]
    return state === 'active' || state === 'winding_down'
  }
  const screenVisible = (moduleId: string): boolean =>
    scope === undefined
      ? teamHas(`${moduleId}:passive`) || teamHas(`${moduleId}:screen`)
      : stateVisible(moduleId)
  const levelAllows = (moduleId: string): boolean => {
    if (scope === undefined) return true
    if (!(MODULE_IDS as readonly string[]).includes(moduleId)) return false
    return isLevelAtLeast(scope.level, getModule(moduleId as ModuleId).minLevel)
  }
  const can = (capability: Capability): boolean => {
    const parts = moduleCapabilityParts(capability)
    if (parts === null || scope === undefined) return teamHas(capability)
    if (parts.kind === 'passive') return stateVisible(parts.moduleId)
    return stateVisible(parts.moduleId) && levelAllows(parts.moduleId)
  }
  return {
    known: true,
    loading: false,
    can,
    showScreen: (moduleId) => screenVisible(moduleId),
    // Busca só o que `can` deixa aparecer: sem o nível, o cartão some e a consulta ainda sairia.
    canFetch: can,
    isWindingDown,
  }
}

/** Sem provider (ex.: componente isolado em teste), vale o padrão seguro. */
export const CapabilitiesContext = createContext<Capabilities>(ALLOW_ALL)

export function useCapabilities(): Capabilities {
  return useContext(CapabilitiesContext)
}
