import { riskBand, riskScore, type RiskLevel } from '@agilebox/core'
import { Button } from '@agilebox/ui'
import styles from './RiskMatrix.module.css'

export interface RiskCell {
  readonly probability: RiskLevel
  readonly impact: RiskLevel
}

export interface RiskMatrixProps {
  readonly risks: readonly RiskCell[]
  readonly selected: RiskCell | null
  readonly onSelect: (cell: RiskCell | null) => void
}

/** Linhas de cima para baixo: probabilidade alta, média, baixa (como no protótipo). */
const ROWS: readonly { readonly value: RiskLevel; readonly label: string }[] = [
  { value: 3, label: 'Alta' },
  { value: 2, label: 'Média' },
  { value: 1, label: 'Baixa' },
]

/** Colunas da esquerda para a direita: impacto baixo, médio, alto. */
const COLUMNS: readonly { readonly value: RiskLevel; readonly label: string }[] = [
  { value: 1, label: 'Baixo' },
  { value: 2, label: 'Médio' },
  { value: 3, label: 'Alto' },
]

const BAND_CLASS = {
  low: styles.low,
  medium: styles.medium,
  high: styles.high,
} as const

/**
 * Matriz 3×3 (probabilidade × impacto) do protótipo. Cada quadrante mostra quantos riscos caem nele e
 * filtra a lista ao ser clicado. A faixa vem com texto na contagem do quadrante, não só na cor.
 */
export function RiskMatrix({ risks, selected, onSelect }: RiskMatrixProps) {
  return (
    <section aria-label="Matriz de riscos" className={styles.matrix}>
      <div className={styles.head}>
        <h3 className={styles.title}>Matriz 3×3 (Prob. × Impacto)</h3>
        <span className={styles.hint}>Clique em um quadrante para filtrar a lista.</span>
        {selected ? (
          <Button type="button" onClick={() => onSelect(null)}>
            Mostrar todos ({risks.length})
          </Button>
        ) : null}
      </div>
      <div className={styles.grid}>
        {ROWS.map((row) => (
          <div key={row.value} className={styles.row}>
            <span className={styles.yLabel}>{row.label}</span>
            {COLUMNS.map((column) => {
              const count = risks.filter(
                (risk) => risk.probability === row.value && risk.impact === column.value,
              ).length
              const isSelected =
                selected !== null &&
                selected.probability === row.value &&
                selected.impact === column.value
              const band = riskBand(riskScore(row.value, column.value))
              return (
                <button
                  key={column.value}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Probabilidade ${row.label}, impacto ${column.label}: ${count} ${count === 1 ? 'risco' : 'riscos'}`}
                  className={`${styles.cell} ${BAND_CLASS[band]} ${isSelected ? styles.selected : ''}`}
                  onClick={() =>
                    onSelect(isSelected ? null : { probability: row.value, impact: column.value })
                  }
                >
                  <span className={styles.count} aria-hidden="true">
                    {count}
                  </span>
                  <span className={styles.countLabel} aria-hidden="true">
                    {count === 1 ? 'risco' : 'riscos'}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
        <div className={`${styles.row} ${styles.xRow}`}>
          <span aria-hidden="true" />
          {COLUMNS.map((column) => (
            <span key={column.value} className={styles.xLabel}>
              {column.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
