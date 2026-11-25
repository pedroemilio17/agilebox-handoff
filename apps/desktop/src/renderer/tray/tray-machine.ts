import type { TrayScreenKind } from './auto-height'

export type TrayScreen =
  | { readonly kind: 'prompt' }
  | { readonly kind: 'home' }
  | { readonly kind: 'kan' }
  | { readonly kind: 'update'; readonly taskId: string }
  | { readonly kind: 'new' }
  | { readonly kind: 'daily' }

export type TrayDirection = 'forward' | 'back'

export interface TrayState {
  readonly screen: TrayScreen
  readonly direction: TrayDirection
  /** Tarefa a destacar na lista (recém-criada ou atualizada). */
  readonly highlightTaskId: string | null
  /** Aviso curto da última ação, mostrado na tela inicial. */
  readonly notice: string | null
}

export type TrayEvent =
  | { readonly type: 'expand' }
  | { readonly type: 'collapse' }
  | { readonly type: 'openKan' }
  | { readonly type: 'openTask'; readonly taskId: string }
  | { readonly type: 'newTask' }
  | { readonly type: 'taskCreated'; readonly taskId: string }
  | { readonly type: 'saved'; readonly taskId: string }
  | { readonly type: 'openDaily' }
  | { readonly type: 'dailySaved' }
  | { readonly type: 'back' }

export const TRAY_NOTICES = {
  saved: 'Atualização salva',
  created: 'Tarefa criada',
  daily: 'Daily registrada.',
} as const

export function createInitialTrayState(initialScreen: 'prompt' | 'home' = 'prompt'): TrayState {
  return {
    screen: { kind: initialScreen },
    direction: 'forward',
    highlightTaskId: null,
    notice: null,
  }
}

export const initialTrayState: TrayState = createInitialTrayState('prompt')

const home = (direction: TrayDirection, patch: Partial<TrayState> = {}): TrayState => ({
  screen: { kind: 'home' },
  direction,
  highlightTaskId: null,
  notice: null,
  ...patch,
})

export function trayReducer(state: TrayState, event: TrayEvent): TrayState {
  switch (event.type) {
    case 'expand':
      return home('forward')
    case 'collapse':
      return {
        screen: { kind: 'prompt' },
        direction: 'back',
        highlightTaskId: null,
        notice: null,
      }
    case 'openKan':
      return {
        ...state,
        screen: { kind: 'kan' },
        direction: 'forward',
        notice: null,
      }
    case 'openTask':
      return {
        ...state,
        screen: { kind: 'update', taskId: event.taskId },
        direction: 'forward',
        notice: null,
      }
    case 'newTask':
      return { ...state, screen: { kind: 'new' }, direction: 'forward', notice: null }
    case 'openDaily':
      return { ...state, screen: { kind: 'daily' }, direction: 'forward', notice: null }
    case 'dailySaved':
      return home('back', { notice: TRAY_NOTICES.daily })
    // Como no protótipo, criar a tarefa volta ao início com o aviso (sem abrir o detalhe).
    case 'taskCreated':
      return home('forward', { highlightTaskId: event.taskId, notice: TRAY_NOTICES.created })
    case 'saved':
      return home('back', { highlightTaskId: event.taskId, notice: TRAY_NOTICES.saved })
    case 'back': {
      if (state.screen.kind === 'prompt') return state
      return home('back')
    }
  }
}

export function screenKind(screen: TrayScreen): TrayScreenKind {
  return screen.kind
}
