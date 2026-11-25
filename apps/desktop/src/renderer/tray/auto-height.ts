export const TRAY_COMPACT_WIDTH = 340
/** Aviso compacto: o conteúdo define a altura (~62px no protótipo). */
export const TRAY_COMPACT_HEIGHT = 62
export const TRAY_EXPANDED_WIDTH = 430
/** Janela expandida do protótipo (bandeja.html): 430×630, sem alça de redimensionar. */
export const TRAY_EXPANDED_HEIGHT = 630

export type TrayScreenKind = 'prompt' | 'home' | 'kan' | 'update' | 'new' | 'daily'

export function autoWidth(screen: TrayScreenKind): number {
  return screen === 'prompt' ? TRAY_COMPACT_WIDTH : TRAY_EXPANDED_WIDTH
}

/** Aviso compacto ~62px; todas as outras telas ocupam 630px fixos. */
export function autoHeight(screen: TrayScreenKind): number {
  return screen === 'prompt' ? TRAY_COMPACT_HEIGHT : TRAY_EXPANDED_HEIGHT
}

/** Duração da troca de dimensões da janela (width/height 240ms var(--ease-ios)). */
export const TRAY_HEIGHT_DURATION_MS = 240

/** cubic-bezier(0.32, 0.72, 0, 1), o `--ease-ios` do protótipo. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x
      if (Math.abs(error) < 1e-5) return sampleY(t)
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-6) break
      t -= error / slope
    }
    let low = 0
    let high = 1
    t = x
    while (low < high) {
      const value = sampleX(t)
      if (Math.abs(value - x) < 1e-5) break
      if (x > value) low = t
      else high = t
      t = (high - low) / 2 + low
      if (high - low < 1e-6) break
    }
    return sampleY(t)
  }
}

const easeIos = cubicBezier(0.32, 0.72, 0, 1)

/** Valor intermediário de uma transição; `progress` vai de 0 a 1 com a curva ease-ios. */
export function tweenHeight(from: number, to: number, progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  return Math.round(from + (to - from) * easeIos(t))
}
