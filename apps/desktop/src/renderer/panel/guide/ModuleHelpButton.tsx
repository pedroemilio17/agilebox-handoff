import { useState } from 'react'
import { getManifest, type ModuleId } from '@agilebox/core'
import type { PanelView } from '../layout/PanelShell'
import { ModuleHelpPanel } from './ModuleHelpPanel'
import { moduleHelpCopy } from './module-help-copy'
import styles from './ModuleHelpButton.module.css'

export interface ModuleHelpButtonProps {
  readonly moduleId: ModuleId
  /** Sem projeto selecionado o botão não aparece. */
  readonly projectId: string | null
  /** Repassado ao painel para o botão "Rever os primeiros passos". */
  readonly onNavigate?: (view: PanelView) => void
}

/** Botão "?" no cabeçalho de uma tela de módulo. Abre o painel "Como funciona". */
export function ModuleHelpButton({ moduleId, projectId, onNavigate }: ModuleHelpButtonProps) {
  const [open, setOpen] = useState(false)
  if (projectId === null) return null
  const name = getManifest(moduleId).name
  return (
    <>
      <button
        type="button"
        className={styles.button}
        aria-label={moduleHelpCopy.buttonLabel(name)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {moduleHelpCopy.buttonText}
      </button>
      {open ? (
        <ModuleHelpPanel
          moduleId={moduleId}
          projectId={projectId}
          onClose={() => setOpen(false)}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ) : null}
    </>
  )
}
