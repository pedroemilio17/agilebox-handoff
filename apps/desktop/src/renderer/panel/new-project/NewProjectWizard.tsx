import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import styles from './NewProject.module.css'
import { newProjectCopy, STATES } from './new-project-copy'
import { visibleSteps, withAnswer, type WizardDraft } from './wizard-steps'

export type WizardPhase = 'name' | 'questions'

export interface NewProjectWizardProps {
  readonly phase: WizardPhase
  readonly name: string
  readonly description: string
  readonly draft: WizardDraft
  /** Mostra o erro do nome ("Digite um nome…"). */
  readonly nameError: boolean
  /** Sobe a cada tentativa sem nome, para devolver o foco ao campo. */
  readonly nameFocusTick?: number
  /** Criação do projeto Simples em andamento: bloqueia novo envio. */
  readonly submitting?: boolean
  readonly onNameChange: (name: string) => void
  readonly onDescriptionChange: (description: string) => void
  readonly onDraftChange: (draft: WizardDraft) => void
  /** "Criar projeto simples agora": cria no modo Simples, sem respostas. */
  readonly onExpress: () => void
  /** "Me ajude a escolher…": segue para as perguntas. */
  readonly onGuided: () => void
  readonly onBackToName: () => void
  /** "Ver sugestão de recursos →": segue para a revisão. */
  readonly onToReview: () => void
}

/**
 * Passos 1 e 2 do novo projeto, como no desenho: nome e descrição com os dois caminhos, depois as
 * perguntas (ADR-10) em cartões de opção. Perguntas que não se aplicam ao trabalho contínuo não
 * aparecem. Todas são opcionais: sem resposta vale "Não sei".
 */
export function NewProjectWizard({
  phase,
  name,
  description,
  draft,
  nameError,
  nameFocusTick = 0,
  submitting = false,
  onNameChange,
  onDescriptionChange,
  onDraftChange,
  onExpress,
  onGuided,
  onBackToName,
  onToReview,
}: NewProjectWizardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const descId = useId()
  const nameErrorId = useId()
  const groupId = useId()

  // Foco no nome ao abrir; nas perguntas, na primeira opção.
  useEffect(() => {
    const target =
      phase === 'name'
        ? nameRef.current
        : rootRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')
    target?.focus()
  }, [phase])

  // Erro do nome devolve o foco ao campo.
  useEffect(() => {
    if (nameFocusTick > 0) nameRef.current?.focus()
  }, [nameFocusTick])

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    onGuided()
  }

  if (phase === 'name') {
    return (
      <div ref={rootRef} className={styles.section}>
        <div className={styles.formFields}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={nameId}>
              {newProjectCopy.nameLabel}
            </label>
            <input
              id={nameId}
              ref={nameRef}
              type="text"
              className={styles.input}
              value={name}
              maxLength={120}
              placeholder={newProjectCopy.namePlaceholder}
              autoComplete="off"
              aria-invalid={nameError || undefined}
              aria-describedby={nameError ? nameErrorId : undefined}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={onNameKeyDown}
            />
            {nameError ? (
              <p id={nameErrorId} className={styles.error} role="alert">
                {newProjectCopy.nameRequired}
              </p>
            ) : null}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={descId}>
              {newProjectCopy.descLabel}
            </label>
            <input
              id={descId}
              type="text"
              className={styles.input}
              value={description}
              maxLength={240}
              placeholder={newProjectCopy.descPlaceholder}
              autoComplete="off"
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.pathsGrid}>
          <div className={styles.pathCol}>
            <div>
              <span className={styles.pathEyebrow}>{newProjectCopy.expressEyebrow}</span>
              <h2>{newProjectCopy.expressTitle}</h2>
              <p>{newProjectCopy.expressText}</p>
              <ul className={styles.statesPreview} aria-label={newProjectCopy.statesLabel}>
                {STATES.map((state) => (
                  <li className={styles.stateItem} key={state.key}>
                    <i className={`${styles.stateDot} ${styles[state.key]}`} aria-hidden="true" />
                    {state.label}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`}
              disabled={submitting}
              aria-busy={submitting || undefined}
              onClick={onExpress}
            >
              {newProjectCopy.express}
            </button>
          </div>

          <div className={styles.pathCol}>
            <div>
              <span className={styles.pathEyebrow}>{newProjectCopy.guidedEyebrow}</span>
              <h2>{newProjectCopy.guidedTitle}</h2>
              <p>{newProjectCopy.guidedText}</p>
            </div>
            <button type="button" className={`${styles.btn} ${styles.btnWide}`} onClick={onGuided}>
              {newProjectCopy.guided}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const questions = visibleSteps(draft)
  return (
    <div ref={rootRef} className={styles.section}>
      <div className={styles.step2Head}>
        <div>
          <span className={styles.eyebrow}>{newProjectCopy.questionsProject}</span>
          <div className={styles.projectName}>{name.trim()}</div>
        </div>
        <span className={styles.sectionMeta}>{newProjectCopy.questionsMeta(questions.length)}</span>
      </div>

      {questions.map((question, index) => {
        const current = question
        const two = current.options.length === 2 || current.options.length === 4
        return (
          <fieldset className={styles.questionBlock} key={current.id}>
            <legend className={styles.questionTitle}>
              {index + 1}. {current.question}
            </legend>
            <p className={styles.questionHint}>{current.hint}</p>
            <div className={`${styles.optionsGrid} ${two ? styles.optionsGridTwo : ''}`}>
              {current.options.map((option) => {
                const checked = draft[current.id] === option.value
                return (
                  <label
                    key={option.value}
                    className={`${styles.optionCard} ${checked ? styles.optionSelected : ''}`}
                  >
                    <input
                      type="radio"
                      className={styles.radio}
                      name={`${groupId}-${current.id}`}
                      value={option.value}
                      checked={checked}
                      onChange={() => onDraftChange(withAnswer(draft, current.id, option.value))}
                    />
                    <strong>{option.label}</strong>
                    {option.hint ? <span>{option.hint}</span> : null}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      <div className={styles.footerBar}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onBackToName}>
          {newProjectCopy.backToName}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onToReview}>
          {newProjectCopy.toReview}
        </button>
      </div>
    </div>
  )
}
