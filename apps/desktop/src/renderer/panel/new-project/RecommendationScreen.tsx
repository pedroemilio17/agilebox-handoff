import { useEffect, useRef, useState } from 'react'
import styles from './NewProject.module.css'
import { newProjectCopy } from './new-project-copy'
import {
  createRecommendationState,
  featureRows,
  recommendationResult,
  toggleFeature,
  type RecommendationResult,
} from './recommendation-state'
import type { WizardDraft } from './wizard-steps'

export interface RecommendationScreenProps {
  readonly name: string
  readonly draft: WizardDraft
  readonly submitting?: boolean
  readonly error?: string | null
  readonly onBack: () => void
  readonly onCreate: (result: RecommendationResult) => void
}

/**
 * Passo 3 do novo projeto (design `revisao-ux/novo-projeto.html`): revisão final limpa em uma
 * coluna com resumo do perfil do Kan, selo do formato sugerido e lista de recursos com switches.
 */
export function RecommendationScreen({
  name,
  draft,
  submitting = false,
  error = null,
  onBack,
  onCreate,
}: RecommendationScreenProps) {
  const [state, setState] = useState(() => createRecommendationState(name, draft))
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const rows = featureRows(state)

  return (
    <div className={styles.reviewWrap}>
      <div className={styles.reviewHead}>
        <div>
          <span className={styles.eyebrow}>{newProjectCopy.reviewEyebrow}</span>
          <h2 ref={headingRef} tabIndex={-1} className={styles.reviewTitle}>
            {name}
          </h2>
          <p className={styles.reviewSummary}>{state.summary}</p>
        </div>
        <span className={styles.sectionMeta}>{state.presetBadge}</span>
      </div>

      <p className={styles.reassurance}>{newProjectCopy.reassurance}</p>

      <section aria-label="Recursos sugeridos">
        <ul className={styles.featureList}>
          {rows.map((row) => (
            <li key={row.key} className={styles.featureRow}>
              <div className={styles.featureText}>
                <span className={styles.featureName}>{row.label}</span>
                <span className={styles.featureDesc}>{row.description}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={row.on}
                aria-label={`${row.on ? 'Desligar' : 'Ligar'} ${row.label}`}
                disabled={row.locked}
                className={styles.switch}
                onClick={() => setState((current) => toggleFeature(current, row.key, !row.on))}
              >
                <span
                  className={row.on ? `${styles.track} ${styles.trackOn}` : styles.track}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
        <p role="status" aria-live="polite" className={styles.status}>
          {state.notice ?? ''}
        </p>
      </section>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.footerBar}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onBack}>
          {newProjectCopy.backToQuestions}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={submitting}
          aria-busy={submitting || undefined}
          onClick={() => onCreate(recommendationResult(state))}
        >
          {newProjectCopy.create}
        </button>
      </div>
    </div>
  )
}
