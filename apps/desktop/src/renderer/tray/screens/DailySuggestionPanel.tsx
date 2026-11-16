import type { DailySummarySuggestionDto } from '@agilebox/contract'
import { Button } from '@agilebox/ui'
import { trayCopy } from '../copy'
import styles from './Daily.module.css'

export interface DailySuggestionPanelProps {
  readonly status: 'loading' | 'error' | 'ready'
  readonly suggestion: DailySummarySuggestionDto | undefined
  /** Coloca a linha de "movidas" no primeiro passo, como texto editável. Não grava nada. */
  readonly onUse: () => void
  readonly onIgnore: () => void
  /** Confirma para leitor de tela que a sugestão foi colocada no texto. */
  readonly usedNotice: boolean
}

const GROUPS = [
  ['advanced', trayCopy.dailySuggestionAdvanced],
  ['nextCandidates', trayCopy.dailySuggestionNext],
  ['blockers', trayCopy.dailySuggestionBlockers],
] as const

/**
 * Painel "Sugestão a partir do que você moveu hoje", no primeiro passo. Nunca grava: o texto só
 * vai para o campo de avanço, que a pessoa pode editar, apagar ou ignorar.
 */
export function DailySuggestionPanel({
  status,
  suggestion,
  onUse,
  onIgnore,
  usedNotice,
}: DailySuggestionPanelProps) {
  const empty =
    suggestion !== undefined &&
    suggestion.advanced.length === 0 &&
    suggestion.nextCandidates.length === 0 &&
    suggestion.blockers.length === 0
  const hasLines = status === 'ready' && suggestion !== undefined && !empty

  return (
    <section className={styles.suggestion} aria-labelledby="daily-suggestion-title">
      <h4 id="daily-suggestion-title" className={styles.suggestionTitle}>
        {trayCopy.dailySuggestionTitle}
      </h4>
      {status === 'loading' ? (
        <p role="status" className={styles.stepHint}>
          {trayCopy.dailySuggestionLoading}
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className={styles.stepHint}>
          {trayCopy.dailySuggestionError}
        </p>
      ) : null}
      {status === 'ready' && empty ? (
        <p className={styles.stepHint}>{trayCopy.dailySuggestionEmpty}</p>
      ) : null}
      {hasLines
        ? GROUPS.map(([key, heading]) =>
            suggestion[key].length === 0 ? null : (
              <div key={key} className={styles.suggestionGroup}>
                <h5 className={styles.suggestionGroupTitle}>{heading}</h5>
                <ul className={styles.suggestionList}>
                  {suggestion[key].map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ),
          )
        : null}
      {hasLines ? (
        <>
          <p className={styles.stepHint}>{trayCopy.dailySuggestionHint}</p>
          <div className={styles.suggestionActions}>
            <Button type="button" onClick={onUse} disabled={suggestion.advanced.length === 0}>
              {trayCopy.dailySuggestionUse}
            </Button>
            <Button type="button" onClick={onIgnore}>
              {trayCopy.dailySuggestionIgnore}
            </Button>
          </div>
        </>
      ) : null}
      <p role="status" className={styles.stepHint}>
        {usedNotice ? trayCopy.dailySuggestionUsed : ''}
      </p>
    </section>
  )
}
