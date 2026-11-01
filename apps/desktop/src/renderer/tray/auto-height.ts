export const TRAY_MIN_HEIGHT = 260
export const TRAY_MAX_HEIGHT = 600
export const TRAY_COLLAPSED_HEIGHT = 52
export const TRAY_KEYBOARD_STEP = 24

export type TrayScreenKind = 'home' | 'update' | 'new'

/** Altura automática por tela (HANDOFF "Bandeja"); no início depende de quantas linhas aparecem (1 a 2). */
export function autoHeight(screen: TrayScreenKind, visibleTasks: number): number {
  if (screen === 'update') return 560
  if (screen === 'new') return 316
  return 246 + Math.max(Math.min(visibleTasks, 2), 1) * 64
}

export function clampHeight(height: number): number {
  return Math.min(TRAY_MAX_HEIGHT, Math.max(TRAY_MIN_HEIGHT, Math.round(height)))
}
