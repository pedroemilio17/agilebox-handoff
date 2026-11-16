import { createContext, useContext } from 'react'
import type { Capability, ModuleId } from '@agilebox/core'

/**
 * Leitura das capacidades do time para a interface. A regra de acesso continua no backend: aqui
 * só se decide o que aparece. Tudo que não chega como capacidade fica escondido.
 */
export interface Capabilities {
  /** Falso enquanto a lista não chegou (carregando ou com erro): nesse caso tudo aparece. */
  readonly known: boolean
  /** A lista ainda está sendo pedida. Não busca dados de módulo antes de saber se ele existe. */
  readonly loading: boolean
  can(capability: Capability): boolean
  /** A tela do módulo aparece: módulo ativo e nível da pessoa alcança o mínimo (`:screen`). */
  showScreen(moduleId: ModuleId): boolean
  /** Pode pedir os dados de uma ferramenta: só depois de a lista chegar, para não pedir o que o backend recusa. */
  canFetch(capability: Capability): boolean
}

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
}

/**
 * Monta a leitura a partir da lista do servidor. `undefined` (sem dados ainda) vira `ALLOW_ALL`,
 * com `loading` para quem ainda espera a lista.
 */
export function buildCapabilities(
  granted: readonly string[] | undefined,
  loading = false,
): Capabilities {
  if (granted === undefined) {
    if (!loading) return ALLOW_ALL
    // Carregando: a tela segue permissiva, mas nenhum dado de módulo é pedido antes da lista.
    return {
      known: false,
      loading: true,
      can: () => true,
      showScreen: () => true,
      canFetch: () => false,
    }
  }
  const set = new Set<string>(granted)
  const can = (capability: Capability) => set.has(capability)
  return {
    known: true,
    loading: false,
    can,
    showScreen: (moduleId) => can(`${moduleId}:screen`),
    canFetch: can,
  }
}

/** Sem provider (ex.: componente isolado em teste), vale o padrão seguro. */
export const CapabilitiesContext = createContext<Capabilities>(ALLOW_ALL)

export function useCapabilities(): Capabilities {
  return useContext(CapabilitiesContext)
}
