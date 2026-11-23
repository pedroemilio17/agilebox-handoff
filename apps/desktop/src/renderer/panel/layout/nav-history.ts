import type { PanelView } from './PanelShell'

export interface NavEntry {
  readonly view: PanelView
  readonly projectId: string | null
}

export const MAX_NAV_HISTORY = 40

/** Empilha a localização atual antes de navegar, evitando duplicatas consecutivas. */
export function pushNavHistory(
  history: readonly NavEntry[],
  current: NavEntry,
  next: NavEntry,
): readonly NavEntry[] {
  if (current.view === next.view && current.projectId === next.projectId) {
    return history
  }
  const appended = [...history, current]
  return appended.length > MAX_NAV_HISTORY
    ? appended.slice(appended.length - MAX_NAV_HISTORY)
    : appended
}

/** Retira o último destino da pilha para a ação do botão Voltar. */
export function popNavHistory(history: readonly NavEntry[]): {
  readonly entry: NavEntry | null
  readonly rest: readonly NavEntry[]
} {
  if (history.length === 0) {
    return { entry: null, rest: history }
  }
  return {
    entry: history[history.length - 1] ?? null,
    rest: history.slice(0, -1),
  }
}
