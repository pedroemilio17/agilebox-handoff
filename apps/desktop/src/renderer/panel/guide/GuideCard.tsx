import { useEffect, useId, useRef, useState } from 'react'
import { Button, ProgressBar } from '@agilebox/ui'
import { useDismissGuideCard } from '../hooks/use-dismiss-guide-card'
import { useGuide } from '../hooks/use-guide'
import type { PanelView } from '../layout/PanelShell'
import { getGuideCardState, type GuideCardState } from './guide-card-state'
import { guideCopy } from './guide-copy'
import styles from './GuideCard.module.css'

export interface GuideCardProps {
  readonly projectId: string | null
  /** Leva à tela do passo (backlog, sprints, agenda). A troca de tela fica com o App. */
  readonly onNavigate: (view: PanelView) => void
  /**
   * Contador de pedidos para abrir o cartão (ex.: "Ver a trilha" da janela de boas-vindas). Cada
   * mudança abre o cartão, se ele estiver visível; não reabre um cartão dispensado.
   */
  readonly openRequest?: number
}

/**
 * Cartão "Primeiros passos" no topo do quadro de um projeto. Se a consulta do guia falhar ou não
 * houver nada a mostrar, não renderiza nada: o guia nunca atrapalha o trabalho.
 */
export function GuideCard({ projectId, onNavigate, openRequest }: GuideCardProps) {
  const guide = useGuide(projectId)
  const state = getGuideCardState(projectId, guide.data)
  if (!state.visible || projectId === null) return null
  // A chave por projeto reinicia o estado local (aberto, dispensado) ao trocar de projeto.
  return (
    <GuideSection
      key={projectId}
      projectId={projectId}
      state={state}
      onNavigate={onNavigate}
      openRequest={openRequest}
    />
  )
}

interface GuideSectionProps {
  readonly projectId: string
  readonly state: GuideCardState
  readonly onNavigate: (view: PanelView) => void
  readonly openRequest: number | undefined
}

function GuideSection({ projectId, state, onNavigate, openRequest }: GuideSectionProps) {
  const headingId = useId()
  const bodyId = useId()
  const [open, setOpen] = useState(state.initiallyOpen)
  const [dismissed, setDismissed] = useState(false)
  const dismiss = useDismissGuideCard()
  // Só o que chega depois da montagem conta: um pedido antigo não reabre o cartão.
  const handledRequest = useRef(openRequest)

  useEffect(() => {
    if (openRequest === undefined || openRequest === handledRequest.current) return
    handledRequest.current = openRequest
    setOpen(true)
  }, [openRequest])

  // Esconde já ao dispensar; se a gravação falhar, o cartão volta.
  if (dismissed && !dismiss.isError) return null

  // Com a trilha concluída não há recolher: o cartão fica aberto só com "Dispensar".
  const expanded = state.complete || open
  const currentPosition = state.steps.findIndex((item) => item.status === 'current') + 1
  const action = state.action

  return (
    <section aria-labelledby={headingId} className={styles.card}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {guideCopy.title}
        </h2>
        <span className={styles.counter}>{state.progressText}</span>
        <ProgressBar
          className={styles.progress}
          done={state.done}
          total={state.total}
          label={guideCopy.progressLabel}
        />
        <span className={styles.hint}>{guideCopy.hint}</span>
        <span className={styles.spacer} />
        {state.complete ? null : (
          <Button
            aria-expanded={open}
            aria-controls={expanded ? bodyId : undefined}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? guideCopy.collapse : guideCopy.expand}
          </Button>
        )}
        <Button
          className={styles.dismiss}
          onClick={() => {
            setDismissed(true)
            dismiss.mutate(projectId)
          }}
        >
          {guideCopy.dismiss}
        </Button>
      </header>

      {expanded ? (
        <div id={bodyId} className={styles.body}>
          <ol className={styles.steps} aria-label={guideCopy.stepList}>
            {state.steps.map((item, index) => (
              <li
                key={item.step.key}
                className={[
                  styles.step,
                  item.status === 'current' ? styles.current : null,
                  item.status === 'done' ? styles.done : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={item.status === 'current' ? 'step' : undefined}
              >
                <span className={styles.mark} aria-hidden="true">
                  {item.status === 'done' ? '✓' : index + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>
                    <span className={styles.srOnly}>{stepStatusLabel(item.status)}: </span>
                    {item.step.title}
                  </span>
                  <span className={styles.stepModule}>{item.step.moduleName}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className={styles.detail}>
            {state.complete ? (
              <div className={styles.block}>
                <h3 className={styles.blockTitle}>{guideCopy.completeTitle}</h3>
                <p className={styles.text}>{guideCopy.completeText}</p>
              </div>
            ) : state.current ? (
              <>
                <span className={styles.eyebrow}>{guideCopy.currentStep(currentPosition)}</span>
                <div className={styles.block}>
                  <h3 className={styles.blockLabel}>{guideCopy.whyLabel}</h3>
                  <p className={styles.text}>{state.current.step.why}</p>
                </div>
                <div className={styles.block}>
                  <h3 className={styles.blockLabel}>{guideCopy.doNowLabel}</h3>
                  <p className={styles.text}>{state.current.step.title}</p>
                  {action?.kind === 'navigate' ? (
                    <Button variant="primary" onClick={() => onNavigate(action.view)}>
                      {action.label}
                    </Button>
                  ) : action?.kind === 'note' ? (
                    <p className={styles.note}>{action.text}</p>
                  ) : null}
                </div>
                <div className={styles.block}>
                  <h3 className={styles.blockLabel}>{guideCopy.nextLabel}</h3>
                  <p className={styles.text}>{state.nextTitle ?? guideCopy.lastStep}</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function stepStatusLabel(status: 'done' | 'current' | 'pending'): string {
  if (status === 'done') return guideCopy.doneMark
  if (status === 'current') return guideCopy.currentMark
  return guideCopy.pendingMark
}
