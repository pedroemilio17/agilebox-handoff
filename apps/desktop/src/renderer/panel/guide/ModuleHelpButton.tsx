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

/** Botão "?" (ícone de 36 px, design: Modulos.dc.html) no cabeçalho de um módulo. Abre "Como funciona". */
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" />
          <path d="M12 17h.01" />
        </svg>
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
