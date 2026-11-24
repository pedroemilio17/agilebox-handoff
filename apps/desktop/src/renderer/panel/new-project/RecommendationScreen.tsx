import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  PROJECT_PRESETS,
  getProjectPreset,
  type GuideExperience,
  type ModuleId,
  type WizardAnswers,
} from '@agilebox/core'
import { Button, useFocusTrap, useRestoreFocus } from '@agilebox/ui'
import styles from './RecommendationScreen.module.css'
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
  readonly onCancel: () => void
  readonly onCreate: (result: RecommendationResult) => void
}

const EXPERIENCE_OPTIONS: readonly { value: GuideExperience; label: string }[] = [
  { value: 'never', label: 'Nunca' },
  { value: 'sometimes', label: 'Algumas vezes' },
  { value: 'always', label: 'Sempre' },
]

const DISCLAIMER = 'Você pode ligar ou desligar recursos depois em Configurações sem perder dados.'

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
  onCancel,
  onCreate,
}: RecommendationScreenProps) {
  const [state, setState] = useState(() => createRecommendationState(name, answers))
  const [showAll, setShowAll] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const focusAfterToggle = useRef<ModuleId | null>(null)
  const titleId = useId()
  const groupName = useId()
  const moreListId = useId()

  useFocusTrap(dialogRef)
  useRestoreFocus()

  // Foco inicial no preset escolhido.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
  }, [])

  // Depois de ligar ou desligar, o módulo muda de lista: o foco vai para o interruptor dele.
  useEffect(() => {
    const pending = focusAfterToggle.current
    if (!pending) return
    focusAfterToggle.current = null
    dialogRef.current?.querySelector<HTMLButtonElement>(`[data-switch-id="${pending}"]`)?.focus()
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

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    onCancel()
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>Recomendação para {name}</span>
            <h1 id={titleId} className={styles.title}>
              {title.base}
              {title.method && (
                <>
                  {' '}
                  <span className={styles.method}>({title.method})</span>
                </>
              )}
            </h1>
            <p className={styles.purpose}>{summary}</p>
          </div>
          <span className={styles.stage}>Etapa final</span>
        </header>

        <div className={styles.chipRow} role="group" aria-label="Outro ponto de partida">
          <span className={styles.eyebrow}>Outro ponto de partida</span>
          {PROJECT_PRESETS.map((item) => {
            const selected = item.key === state.preset
            const recommended = item.key === state.recommendedPreset
            return (
              <button
                key={item.key}
                type="button"
                className={selected ? styles.chipSelected : styles.chip}
                aria-pressed={selected}
                onClick={() => setState((current) => choosePreset(current, item.key))}
              >
                {presetTitleParts(item.label).base}
                {recommended && <span className={styles.tag}>recomendado</span>}
              </button>
            )
          })}
        </div>

        <div className={styles.grid}>
          <section className={styles.modules} aria-label="Módulos do projeto">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Vai ligar</span>
              <span className={styles.count}>{countLabel(rows.on.length)}</span>
            </div>
            <ModuleList rows={rows.on} isOn onToggle={toggle} />

            {rows.off.length > 0 && (
              <>
                <div className={styles.sectionHead}>
                  <span className={styles.eyebrow}>Desligados</span>
                </div>
                <ModuleList rows={rows.off} isOn={false} onToggle={toggle} />
              </>
            )}

            {note && (
              <div className={styles.note}>
                <span className={styles.noteText}>{note}</span>
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
              <ul id={moreListId} className={styles.moreList} aria-label="Outros módulos">
                {others.map((row) => (
                  <li key={row.id} className={styles.moreRow}>
                    <span className={styles.moduleName}>
                      {row.name}
                      {row.level !== null && <span className={styles.level}>N{row.level}</span>}
                    </span>
                    <span className={styles.reason}>{row.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            <p role="status" aria-live="polite" className={styles.status}>
              {state.notice ?? ''}
            </p>
          </section>

          <section className={styles.experience} aria-label="Experiência da equipe">
            <div className={styles.card}>
              <span className={styles.counter}>
                Pergunta {WIZARD_TOTAL_STEPS} de {WIZARD_TOTAL_STEPS}
              </span>
              <fieldset className={styles.fieldset}>
                <legend className={styles.question}>{experienceQuestion(state.preset)}</legend>
                <div className={styles.segments}>
                  {EXPERIENCE_OPTIONS.map((option) => {
                    const checked = state.guideLevel === option.value
                    return (
                      <label
                        key={option.value}
                        className={checked ? styles.segmentChecked : styles.segment}
                      >
                        <input
                          type="radio"
                          className={styles.radio}
                          name={groupName}
                          value={option.value}
                          checked={checked}
                          onChange={() =>
                            setState((current) => changeExperience(current, option.value))
                          }
                        />
                        {option.label}
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
            </div>
            <p className={styles.disclaimer}>
              <svg
                className={styles.disclaimerIcon}
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
              <span>{DISCLAIMER}</span>
            </p>
          </section>
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <footer className={styles.footer}>
          <Button className={styles.secondaryAction} onClick={onBack}>
            Voltar
          </Button>
          <span className={styles.spacer} />
          <span className={styles.footNote}>Obrigatório foi só o nome.</span>
          <Button
            variant="primary"
            className={styles.primaryAction}
            disabled={submitting}
            aria-busy={submitting || undefined}
            onClick={() => onCreate(recommendationResult(state))}
          >
            Criar projeto
          </Button>
        </footer>
      </div>
    </div>
  )
}

function countLabel(count: number): string {
  return count === 1 ? '1 módulo' : `${count} módulos`
}

interface ModuleListProps {
  readonly rows: readonly ModuleRow[]
  readonly isOn: boolean
  readonly onToggle: (row: ModuleRow, on: boolean) => void
}

function ModuleList({ rows, isOn, onToggle }: ModuleListProps) {
  return (
    <ul className={styles.moduleList}>
      {rows.map((row) => (
        <li key={row.id} className={styles.moduleRow}>
          <div className={styles.moduleText}>
            <span className={styles.moduleName}>
              {row.name}
              {row.level !== null && <span className={styles.level}>N{row.level}</span>}
            </span>
            <span className={styles.reason}>{row.reason}</span>
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
            <span className={isOn ? styles.trackOn : styles.track} aria-hidden="true">
              <span className={styles.thumb} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
