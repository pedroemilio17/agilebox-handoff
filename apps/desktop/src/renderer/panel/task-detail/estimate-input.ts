import { taskDetailCopy } from './copy'

export type EstimateInput =
  | { readonly ok: true; readonly hours: number | null }
  | { readonly ok: false; readonly message: string }

/** Até 4 dígitos inteiros e até 2 casas, com ponto ou vírgula (ADR-07). */
const DECIMAL = /^(\d{1,4})(?:[.,](\d{1,2}))?$/u
const MAX_HUNDREDTHS = 100_000

/**
 * Lê o campo Estimativa (h). Vazio limpa (`hours: null`). Aceita 0 a 1000 com até duas casas,
 * em vírgula ou ponto. Não arredonda: o que passa de duas casas é recusado.
 */
export function parseEstimateInput(text: string): EstimateInput {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: true, hours: null }
  const match = DECIMAL.exec(trimmed)
  if (!match) return { ok: false, message: taskDetailCopy.estimateInvalid }
  const hundredths = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  if (hundredths > MAX_HUNDREDTHS) return { ok: false, message: taskDetailCopy.estimateInvalid }
  return { ok: true, hours: hundredths / 100 }
}

/** Texto do campo a partir do valor gravado: 2.5 vira "2,5"; nulo vira vazio. */
export function formatEstimateInput(hours: number | null): string {
  return hours === null ? '' : String(hours).replace('.', ',')
}
