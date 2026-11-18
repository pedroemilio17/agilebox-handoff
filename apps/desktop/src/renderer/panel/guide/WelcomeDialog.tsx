import { useEffect, useId, useRef, useState } from 'react'
import { Button, useFocusTrap, useRestoreFocus } from '@agilebox/ui'
import { useGuide } from '../hooks/use-guide'
import { useResolveGuideWelcome } from '../hooks/use-resolve-guide-welcome'
import { getWelcomeState, type WelcomeState } from './welcome-state'
import { welcomeCopy } from './welcome-copy'
import styles from './WelcomeDialog.module.css'

export interface WelcomeDialogProps {
  readonly projectId: string
  /** Nome completo da pessoa; o título usa só o primeiro nome. */
  readonly personName?: string | undefined
  /** "Ver a trilha": o pai abre o cartão "Primeiros passos". */
  readonly onSeeTrail: () => void
}

/**
 * Janela de boas-vindas (ADR-10; design: BoasVindas.dc.html): diálogo de vidro com o projeto e a trilha de primeiros passos.
 * É a única janela modal de entrada; qualquer resposta ("Agora não", Esc ou "Ver a trilha") grava
 * a resposta. Se a consulta falhar ou não houver janela a mostrar, não renderiza nada.
 */
export function WelcomeDialog({ projectId, personName, onSeeTrail }: WelcomeDialogProps) {
  const guide = useGuide(projectId)
  // Dado de outro projeto (troca rápida) não serve: a janela espera o do projeto atual.
  if (guide.isError || guide.data?.projectId !== projectId) return null
  const state = getWelcomeState(guide.data, personName)
  if (!state.visible) return null
  return <WelcomeContent projectId={projectId} state={state} onSeeTrail={onSeeTrail} />
}

interface WelcomeContentProps {
  readonly projectId: string
  readonly state: WelcomeState
  readonly onSeeTrail: () => void
}

function WelcomeContent({ projectId, state, onSeeTrail }: WelcomeContentProps) {
  const titleId = useId()
  const trailId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const resolve = useResolveGuideWelcome()
  const [answered, setAnswered] = useState(false)
  // Respondido e gravado: some. Se a gravação falhar, a janela volta com o aviso.
  const hidden = answered && !resolve.isError

  // Ordem importa: a restauração de foco guarda o elemento focado antes da janela assumir o foco.
  useRestoreFocus()
  useFocusTrap(dialogRef)

  useEffect(() => {
    if (!hidden) primaryRef.current?.focus()
  }, [hidden])

  function respond(next: () => void) {
    if (answered && !resolve.isError) return
    setAnswered(true)
    resolve.mutate(projectId)
    next()
  }

  const noop = () => undefined

  return (
    // O véu não fecha a janela: a resposta é explícita. A janela fica no DOM e só some com `hidden`,
    // para o foco preso continuar ligado se ela voltar após uma falha.
    <div className={styles.backdrop} hidden={hidden}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.dialog}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            respond(noop)
          }
        }}
      >
        <header className={styles.header}>
          <span className={styles.eyebrow}>{welcomeCopy.eyebrow}</span>
          <h2 id={titleId} className={styles.title}>
            {state.title}
          </h2>
          <p className={styles.intro}>{state.intro}</p>
        </header>

        <section className={styles.trail} aria-labelledby={trailId}>
          <h3 id={trailId} className={styles.trailTitle}>
            {welcomeCopy.trailQuestion}
          </h3>
          <p className={styles.count}>
            <span>{welcomeCopy.stepCount(state.stepCount)}</span> {welcomeCopy.trailIntro}
          </p>
          <ol className={styles.steps} aria-label={welcomeCopy.stepList}>
            {state.steps.map((step, index) => (
              <li key={step.key} className={styles.step}>
                <span className={styles.mark} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.stepTitle}>{step.title}</span>
              </li>
            ))}
          </ol>
        </section>

        {resolve.isError ? (
          <p role="alert" className={styles.error}>
            {welcomeCopy.saveError}
          </p>
        ) : null}

        <footer className={styles.footer}>
          <span className={styles.hint}>{welcomeCopy.hint}</span>
          <span className={styles.spacer} />
          <Button className={styles.later} onClick={() => respond(noop)}>
            {welcomeCopy.later}
          </Button>
          <Button
            variant="primary"
            className={styles.seeTrail}
            ref={primaryRef}
            onClick={() => respond(onSeeTrail)}
          >
            {welcomeCopy.seeTrail}
          </Button>
        </footer>
      </div>
    </div>
  )
}
