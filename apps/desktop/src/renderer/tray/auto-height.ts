export const TRAY_COMPACT_WIDTH = 340
export const TRAY_COMPACT_HEIGHT = 88
export const TRAY_EXPANDED_WIDTH = 430
export const TRAY_MIN_HEIGHT = 280
export const TRAY_MAX_HEIGHT = 660
export const TRAY_COLLAPSED_HEIGHT = TRAY_COMPACT_HEIGHT
export const TRAY_KEYBOARD_STEP = 24

export type TrayScreenKind = 'prompt' | 'home' | 'kan' | 'update' | 'new' | 'daily'

/** Espaço extra da barra de convite da daily na tela inicial. */
export const DAILY_INVITE_HEIGHT = 136

export function autoWidth(screen: TrayScreenKind): number {
  return screen === 'prompt' ? TRAY_COMPACT_WIDTH : TRAY_EXPANDED_WIDTH
}

/**
 * Altura automática por tela da nova bandeja:
 * - aviso inicial compacto: 340×88
 * - início expandido: 340 + 64 por tarefa visível (1 a 3) + barra enxuta da daily quando visível (teto 630)
 * - chat com o Kan: 430×630
 */
export function autoHeight(
  screen: TrayScreenKind,
  visibleTasks: number,
  inviteVisible = false,
): number {
  if (screen === 'prompt') return TRAY_COMPACT_HEIGHT
  if (screen === 'kan') return 630
  if (screen === 'update' || screen === 'daily') return 600
  if (screen === 'new') return 430
  const base =
    340 + Math.max(Math.min(visibleTasks, 3), 1) * 64 + (inviteVisible ? DAILY_INVITE_HEIGHT : 0)
  return Math.min(630, base)
}

export function clampHeight(height: number): number {
  return Math.min(TRAY_MAX_HEIGHT, Math.max(TRAY_MIN_HEIGHT, Math.round(height)))
}

/** Duração da troca de dimensões automáticas da bandeja. */
export const TRAY_HEIGHT_DURATION_MS = 450

/** Altura intermediária de uma transição; `progress` vai de 0 a 1 com desaceleração no fim. */
export function tweenHeight(from: number, to: number, progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  const eased = 1 - (1 - t) ** 3
  return Math.round(from + (to - from) * eased)
}
