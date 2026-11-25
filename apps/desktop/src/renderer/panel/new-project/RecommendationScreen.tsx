import { useEffect, useId, useRef, useState } from 'react'
import {
  PROJECT_PRESETS,
  getProjectPreset,
  type GuideExperience,
  type ModuleId,
  type WizardAnswers,
} from '@agilebox/core'
import styles from './NewProject.module.css'
import { newProjectCopy } from './new-project-copy'
import {
  changeExperience,
  choosePreset,
  createRecommendationState,
  disableModule,
  enableModule,
  experienceQuestion,
  guideBullets,
  moduleRows,
  otherModuleRows,
  presetTitleParts,
  recommendationNoteFor,
  recommendationResult,
  summaryFor,
  type ModuleRow,
  type RecommendationResult,
} from './recommendation-state'
import { WIZARD_TOTAL_STEPS } from './wizard-steps'

export interface RecommendationScreenProps {
  readonly name: string
  readonly answers: WizardAnswers
  readonly submitting?: boolean
  readonly error?: string | null
  readonly onBack: () => void
  readonly onCreate: (result: RecommendationResult) => void
}

const EXPERIENCE_OPTIONS: readonly { value: GuideExperience; label: string }[] = [
  { value: 'never', label: 'Nunca' },
  { value: 'sometimes', label: 'Algumas vezes' },
  { value: 'always', label: 'Sempre' },
]

/**
 * Recomendação do novo projeto (ADR-10, pergunta 6 e etapa final). Mostra o preset recomendado,
 * os módulos que vão ligar com o motivo de cada um e a experiência da equipe.
 */
export function RecommendationScreen({
  name,
  answers,
  submitting = false,
  error = null,
  onBack,
  onCreate,
}: RecommendationScreenProps) {
  const [state, setState] = useState(() => createRecommendationState(name, answers))
  const [showAll, setShowAll] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusAfterToggle = useRef<ModuleId | null>(null)
  const groupName = useId()
  const moreListId = useId()

  // Foco no título ao abrir a revisão, para o leitor de tela anunciar a nova etapa.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // Depois de ligar ou desligar, o módulo muda de lista: o foco vai para o interruptor dele.
  useEffect(() => {
    const pending = focusAfterToggle.current
    if (!pending) return
    focusAfterToggle.current = null
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-switch-id="${pending}"]`)?.focus()
  })

  const preset = getProjectPreset(state.preset)
  const title = presetTitleParts(preset.label)
  const summary = summaryFor(state)
  const rows = moduleRows(state)
  const note = recommendationNoteFor(state)
  const others = otherModuleRows(state)

  function toggle(row: ModuleRow, on: boolean) {
    focusAfterToggle.current = row.id
    setState((current) => (on ? disableModule(current, row.id) : enableModule(current, row.id)))
  }

  return (
    <div ref={rootRef} className={styles.reviewWrap}>
      <div className={styles.reviewHead}>
        <div>
          <span className={styles.eyebrow}>{newProjectCopy.reviewEyebrow}</span>
          <h2 ref={headingRef} tabIndex={-1} className={styles.reviewTitle}>
            {name}
          </h2>
          <p className={styles.reviewSummary}>{summary}</p>
        </div>
        <span className={styles.sectionMeta}>
          {title.base}
          {title.method ? ` (${title.method})` : ''}
        </span>
      </div>

      <p className={styles.reassurance}>{newProjectCopy.reassurance}</p>

      <div className={styles.presetRow} role="group" aria-label={newProjectCopy.presetsLabel}>
        <span className={styles.eyebrow}>{newProjectCopy.presetsLabel}</span>
        {PROJECT_PRESETS.map((item) => {
          const selected = item.key === state.preset
          const recommended = item.key === state.recommendedPreset
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.chip} ${selected ? styles.chipActive : ''}`}
              aria-pressed={selected}
              onClick={() => setState((current) => choosePreset(current, item.key))}
            >
              {presetTitleParts(item.label).base}
              {recommended && <span className={styles.tag}>recomendado</span>}
            </button>
          )
        })}
      </div>

      <section aria-label="Módulos do projeto">
        <ul className={styles.featureList}>
          <ModuleRows rows={rows.on} isOn onToggle={toggle} />
          <ModuleRows rows={rows.off} isOn={false} onToggle={toggle} />
        </ul>
        <span className={styles.sectionMeta}>{countLabel(rows.on.length)}</span>

        {note && (
          <div className={styles.note}>
            <span>{note}</span>
            {others.length > 0 && (
              <button
                type="button"
                className={styles.more}
                aria-expanded={showAll}
                aria-controls={moreListId}
                onClick={() => setShowAll((current) => !current)}
              >
                Ver todos
              </button>
            )}
          </div>
        )}
        {showAll && others.length > 0 && (
          <ul id={moreListId} className={styles.featureList} aria-label="Outros módulos">
            {others.map((row) => (
              <li key={row.id} className={styles.featureRow}>
                <div className={styles.featureText}>
                  <span className={styles.featureName}>
                    {row.name}
                    {row.level !== null && <span className={styles.level}>N{row.level}</span>}
                  </span>
                  <span className={styles.featureDesc}>{row.reason}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p role="status" aria-live="polite" className={styles.status}>
          {state.notice ?? ''}
        </p>
      </section>

      <fieldset className={styles.questionBlock}>
        <legend className={styles.questionTitle}>{experienceQuestion(state.preset)}</legend>
        <span className={styles.sectionMeta}>
          Pergunta {WIZARD_TOTAL_STEPS} de {WIZARD_TOTAL_STEPS}
        </span>
        <div className={styles.optionsGrid}>
          {EXPERIENCE_OPTIONS.map((option) => {
            const checked = state.guideLevel === option.value
            return (
              <label
                key={option.value}
                className={`${styles.optionCard} ${checked ? styles.optionSelected : ''}`}
              >
                <input
                  type="radio"
                  className={styles.radio}
                  name={groupName}
                  value={option.value}
                  checked={checked}
                  onChange={() => setState((current) => changeExperience(current, option.value))}
                />
                <strong>{option.label}</strong>
              </label>
            )
          })}
        </div>
        <ul className={styles.bullets}>
          {guideBullets(state.guideLevel).map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </fieldset>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

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

function countLabel(count: number): string {
  return count === 1 ? '1 módulo' : `${count} módulos`
}

interface ModuleRowsProps {
  readonly rows: readonly ModuleRow[]
  readonly isOn: boolean
  readonly onToggle: (row: ModuleRow, on: boolean) => void
}

/** Linhas do desenho: nome e motivo à esquerda, interruptor 40x22 à direita. */
function ModuleRows({ rows, isOn, onToggle }: ModuleRowsProps) {
  return (
    <>
      {rows.map((row) => (
        <li key={row.id} className={styles.featureRow}>
          <div className={styles.featureText}>
            <span className={styles.featureName}>
              {row.name}
              {row.level !== null && <span className={styles.level}>N{row.level}</span>}
            </span>
            <span className={styles.featureDesc}>{row.reason}</span>
          </div>
          <button
            type="button"
            role="switch"
            data-switch-id={row.id}
            aria-checked={isOn}
            aria-label={`${isOn ? 'Desligar' : 'Ligar'} ${row.name}`}
            className={styles.switch}
            onClick={() => onToggle(row, isOn)}
          >
            <span
              className={isOn ? `${styles.track} ${styles.trackOn}` : styles.track}
              aria-hidden="true"
            />
          </button>
        </li>
      ))}
    </>
  )
}
