/** Mesmo teto do contrato (`ESTIMATE_MAX_HOURS`): de 0 a 9999 horas. */
const ESTIMATE_MAX = 9999

export type EstimateInput =
  { readonly ok: true; readonly hours: number | null } | { readonly ok: false }

/**
 * Lê o campo "Estimativa (h)": vazio tira a estimativa (null); senão, número de 0 a 9999 com até
 * 2 casas, com vírgula ou ponto. Não calcula valor; o servidor refaz a conta em centésimos.
 */
export function parseEstimateInput(text: string): EstimateInput {
  const value = text.trim()
  if (value === '') return { ok: true, hours: null }
  if (!/^\d{1,4}(?:[,.]\d{1,2})?$/u.test(value)) return { ok: false }
  const hours = Number(value.replace(',', '.'))
  if (hours > ESTIMATE_MAX) return { ok: false }
  return { ok: true, hours: Math.round(hours * 100) / 100 }
}
