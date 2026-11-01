/** Opacidade do fundo da janela (Ajustes → Aparência), guardada neste computador e aplicada às duas janelas. */
export const WINDOW_OPACITY_KEY = 'agilebox.windowOpacity'
export const WINDOW_OPACITY_DEFAULT = 0.68
export const WINDOW_OPACITY_MIN = 0.3
export const WINDOW_OPACITY_MAX = 0.95

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return WINDOW_OPACITY_DEFAULT
  return Math.min(WINDOW_OPACITY_MAX, Math.max(WINDOW_OPACITY_MIN, Math.round(value * 100) / 100))
}

export function readWindowOpacity(): number {
  try {
    const stored = window.localStorage.getItem(WINDOW_OPACITY_KEY)
    return stored === null ? WINDOW_OPACITY_DEFAULT : clampOpacity(Number(stored))
  } catch {
    return WINDOW_OPACITY_DEFAULT
  }
}

function apply(value: number): void {
  document.documentElement.style.setProperty('--glass-window-alpha', String(value))
}

export function saveWindowOpacity(value: number): number {
  const next = clampOpacity(value)
  apply(next)
  try {
    window.localStorage.setItem(WINDOW_OPACITY_KEY, String(next))
  } catch {
    // Sem armazenamento a mudança vale só até fechar o app.
  }
  return next
}

/** Aplica o valor salvo e acompanha mudanças feitas na outra janela (painel ↔ bandeja). */
export function applyWindowOpacity(): void {
  apply(readWindowOpacity())
  window.addEventListener('storage', (event) => {
    if (event.key === WINDOW_OPACITY_KEY) apply(readWindowOpacity())
  })
}
