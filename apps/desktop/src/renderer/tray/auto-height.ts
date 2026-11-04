export const TRAY_MIN_HEIGHT = 260
export const TRAY_MAX_HEIGHT = 600
export const TRAY_COLLAPSED_HEIGHT = 52
export const TRAY_KEYBOARD_STEP = 24

export type TrayScreenKind = 'home' | 'update' | 'new' | 'daily'

/** Espaço extra do cartão de convite da daily na tela inicial. */
export const DAILY_INVITE_HEIGHT = 156

/**
 * Altura automática por tela (HANDOFF "Bandeja"); no início depende de quantas linhas aparecem (1 a 2)
 * e de o cartão de convite da daily estar visível.
 */
export function autoHeight(
  screen: TrayScreenKind,
  visibleTasks: number,
  inviteVisible = false,
): number {
  if (screen === 'update' || screen === 'daily') return 560
  if (screen === 'new') return 316
  return (
    246 + Math.max(Math.min(visibleTasks, 2), 1) * 64 + (inviteVisible ? DAILY_INVITE_HEIGHT : 0)
  )
}

export function clampHeight(height: number): number {
  return Math.min(TRAY_MAX_HEIGHT, Math.max(TRAY_MIN_HEIGHT, Math.round(height)))
}

/** Duração da troca de altura automática (HANDOFF "Bandeja": height .45s). */
export const TRAY_HEIGHT_DURATION_MS = 450

/** Altura intermediária de uma transição; `progress` vai de 0 a 1 com desaceleração no fim. */
export function tweenHeight(from: number, to: number, progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  const eased = 1 - (1 - t) ** 3
  return Math.round(from + (to - from) * eased)
}
