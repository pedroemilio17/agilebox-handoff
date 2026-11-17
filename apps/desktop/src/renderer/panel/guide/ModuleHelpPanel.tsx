import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button, useFocusTrap, useRestoreFocus } from '@agilebox/ui'
import type { ModuleId } from '@agilebox/core'
import { useGuide } from '../hooks/use-guide'
import { useProjectModules } from '../hooks/use-project-modules'
import type { PanelView } from '../layout/PanelShell'
import { EXPERIENCE_LABELS, moduleHelp, type ModuleHelpLink } from './module-help'
import { moduleHelpCopy } from './module-help-copy'
import styles from './ModuleHelpPanel.module.css'

export interface ModuleHelpPanelProps {
  readonly moduleId: ModuleId
  readonly projectId: string
  readonly onClose: () => void
  /** Leva ao quadro para rever os primeiros passos. Sem ele, o botão não aparece. */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Painel "Como funciona" de um módulo: vidro à direita, com o objetivo, o porquê, o fluxo do
 * manifesto e as ligações com outros módulos no estado do projeto. O foco fica preso no painel e
 * volta ao botão "?" ao fechar. Esc e o botão Fechar fecham.
 */
export function ModuleHelpPanel({
  moduleId,
  projectId,
  onClose,
  onNavigate,
}: ModuleHelpPanelProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  useRestoreFocus(true)
  useFocusTrap(dialogRef, true)

  const modules = useProjectModules(projectId)
  const guide = useGuide(projectId)
  const help = moduleHelp(moduleId, modules.data?.modules ?? [], guide.data?.experience ?? null)

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
  }, [])

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.panel}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>{moduleHelpCopy.eyebrow}</span>
            <div className={styles.titleRow}>
              <h2 id={titleId} className={styles.title}>
                {help.name}
              </h2>
              {help.levelLabel ? <span className={styles.level}>{help.levelLabel}</span> : null}
            </div>
            <p className={styles.objective}>{help.objective}</p>
          </div>
          <Button className={styles.close} onClick={onClose}>
            {moduleHelpCopy.close}
          </Button>
        </header>

        <section className={styles.section}>
          <h3 className={styles.label}>{moduleHelpCopy.whyLabel}</h3>
          <p className={styles.text}>{help.why}</p>
        </section>

        {help.flow.length > 0 ? (
          <section className={styles.section}>
            <h3 className={styles.label}>{moduleHelpCopy.flowLabel}</h3>
            <ol className={styles.flow}>
              {help.flow.map((step, index) => (
                <li key={step} className={styles.flowStep}>
                  <span className={styles.flowNumber}>{index + 1}</span>
                  <span className={styles.flowText}>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className={styles.section}>
          <h3 className={styles.label}>{moduleHelpCopy.linksLabel}</h3>
          {help.links.length === 0 ? (
            <p className={styles.text}>{moduleHelpCopy.noLinks}</p>
          ) : (
            <ul className={styles.links}>
              {help.links.map((link) => (
                <LinkRow
                  key={`${link.kind}:${link.moduleId}`}
                  link={link}
                  status={
                    modules.isPending
                      ? moduleHelpCopy.stateLoading
                      : modules.isError
                        ? moduleHelpCopy.stateError
                        : link.on
                          ? moduleHelpCopy.stateOn
                          : moduleHelpCopy.stateOff
                  }
                  isOn={!modules.isPending && !modules.isError && link.on}
                />
              ))}
            </ul>
          )}
        </section>

        <footer className={styles.footer}>
          {onNavigate ? (
            <Button
              variant="primary"
              className={styles.review}
              onClick={() => {
                onClose()
                onNavigate('projects')
              }}
            >
              {moduleHelpCopy.reviewSteps}
            </Button>
          ) : null}
          {help.experience ? (
            <p className={styles.experience}>
              {moduleHelpCopy.experiencePrefix} {EXPERIENCE_LABELS[help.experience]},{' '}
              {moduleHelpCopy.experienceSuffix}
            </p>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  )
}

interface LinkRowProps {
  readonly link: ModuleHelpLink
  readonly status: string
  readonly isOn: boolean
}

function LinkRow({ link, status, isOn }: LinkRowProps) {
  return (
    <li className={styles.link}>
      <span className={styles.linkKind}>{moduleHelpCopy.linkKind[link.kind]}</span>
      <span className={styles.linkName}>{link.name}</span>
      <span className={isOn ? styles.linkOn : styles.linkOff}>{status}</span>
    </li>
  )
}
