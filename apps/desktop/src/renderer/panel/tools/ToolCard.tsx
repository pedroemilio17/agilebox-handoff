import { useId } from 'react'
import { MODULE_LABELS } from '@agilebox/core'
import type { ModuleId, ModuleState } from '@agilebox/core'
import { Card, Switch } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { dependencyText } from './dependency-text'
import { toolSignal, type ToolSignal } from './tool-draft'
import styles from './ToolCard.module.css'

export interface ToolCardProps {
  readonly moduleId: ModuleId
  /** Se a ferramenta está ligada no rascunho (não no servidor). */
  readonly on: boolean
  /** Estado que o servidor devolveu, para dizer "Encerrando" quando couber. */
  readonly serverState: ModuleState
  readonly onToggle: (wanted: boolean) => void
}

const SIGNAL_TEXT: Record<ToolSignal, string> = {
  on: panelCopy.toolsSignalOn,
  off: panelCopy.toolsSignalOff,
  winding: panelCopy.toolsSignalWinding,
}

/** Um ícone por sinal, para o estado nunca depender só da cor. */
const SIGNAL_ICON: Record<ToolSignal, string> = {
  on: 'M3 8.5 6.5 12 13 4.5',
  off: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z',
  winding: 'M8 2 15 14H1L8 2Z M8 6v4m0 2v.5',
}

/** Cartão de uma ferramenta: interruptor (`role="switch"`), dependência e sinal de estado. */
export function ToolCard({ moduleId, on, serverState, onToggle }: ToolCardProps) {
  const name = MODULE_LABELS[moduleId]
  const signal = toolSignal(on, serverState)
  const ids = useId()
  const dependencyId = `${ids}-dependency`
  const signalId = `${ids}-signal`

  return (
    <Card role="article" aria-label={name} className={styles.card}>
      <Switch
        checked={on}
        disabled={moduleId === 'core'}
        onCheckedChange={onToggle}
        aria-describedby={`${dependencyId} ${signalId}`}
      >
        {name}
      </Switch>
      <p id={dependencyId} className={styles.dependency}>
        {dependencyText(moduleId)}
      </p>
      <p id={signalId} className={`${styles.signal} ${styles[signal]}`} data-signal={signal}>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={SIGNAL_ICON[signal]} />
        </svg>
        {SIGNAL_TEXT[signal]}
      </p>
    </Card>
  )
}
