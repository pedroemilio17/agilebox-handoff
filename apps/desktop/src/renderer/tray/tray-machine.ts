import type { TrayScreenKind } from './auto-height'

export type TrayScreen =
  | { readonly kind: 'home' }
  | { readonly kind: 'update'; readonly taskId: string; readonly created: boolean }
  | { readonly kind: 'new' }

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
  | { readonly type: 'openTask'; readonly taskId: string }
  | { readonly type: 'newTask' }
  | { readonly type: 'taskCreated'; readonly taskId: string }
  | { readonly type: 'saved'; readonly taskId: string }
  | { readonly type: 'back' }

export const TRAY_NOTICES = {
  saved: 'Atualização salva',
  created: 'Tarefa criada',
} as const

export const initialTrayState: TrayState = {
  screen: { kind: 'home' },
  direction: 'forward',
  highlightTaskId: null,
  notice: null,
}

const home = (direction: TrayDirection, patch: Partial<TrayState> = {}): TrayState => ({
  screen: { kind: 'home' },
  direction,
  highlightTaskId: null,
  notice: null,
  ...patch,
})

export function trayReducer(state: TrayState, event: TrayEvent): TrayState {
  switch (event.type) {
    case 'openTask':
      return {
        ...state,
        screen: { kind: 'update', taskId: event.taskId, created: false },
        direction: 'forward',
        notice: null,
      }
    case 'newTask':
      return { ...state, screen: { kind: 'new' }, direction: 'forward', notice: null }
    case 'taskCreated':
      return {
        ...state,
        screen: { kind: 'update', taskId: event.taskId, created: true },
        direction: 'forward',
      }
    case 'saved': {
      const created = state.screen.kind === 'update' && state.screen.created
      return home('back', {
        highlightTaskId: event.taskId,
        notice: created ? TRAY_NOTICES.created : TRAY_NOTICES.saved,
      })
    }
    case 'back': {
      if (state.screen.kind === 'update' && state.screen.created) {
        return home('back', { highlightTaskId: state.screen.taskId, notice: TRAY_NOTICES.created })
      }
      return home('back')
    }
  }
}

export function screenKind(screen: TrayScreen): TrayScreenKind {
  return screen.kind
}
