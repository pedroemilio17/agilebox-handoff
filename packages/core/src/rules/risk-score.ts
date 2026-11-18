import { ValidationError } from '../shared/errors'
import { RISK_LEVELS } from '../entities/risk'

/**
 * Pontuação e faixa de um risco (ADR-10). Pontuação = probabilidade × impacto, com cada um de 1 a 3.
 * As faixas são baixo (1 a 2), médio (3 a 4) e alto (6 a 9). As pontuações possíveis são 1, 2, 3, 4,
 * 6 e 9, então não há faixa para 5.
 */
export type RiskBand = 'low' | 'medium' | 'high'

export function riskScore(probability: number, impact: number): number {
  assertLevel(probability, 'Probabilidade')
  assertLevel(impact, 'Impacto')
  return probability * impact
}

export function riskBand(score: number): RiskBand {
  if (score >= 1 && score <= 2) return 'low'
  if (score >= 3 && score <= 4) return 'medium'
  if (score >= 6 && score <= 9) return 'high'
  throw new ValidationError('Pontuação de risco fora da escala')
}

/** Ordena por pontuação, da maior para a menor. Empate: título em ordem alfabética, depois id. */
export function sortRisksByScore<
  T extends {
    readonly id: string
    readonly title: string
    readonly probability: number
    readonly impact: number
  },
>(risks: readonly T[]): T[] {
  return [...risks].sort(
    (a, b) =>
      riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact) ||
      a.title.localeCompare(b.title, 'pt-BR') ||
      a.id.localeCompare(b.id),
  )
}

function assertLevel(value: number, label: string): void {
  if (!RISK_LEVELS.some((level) => level === value))
    throw new ValidationError(`${label} deve ser baixa, média ou alta`)
}
