import type { ReactNode } from 'react'
import { trayCopy } from './copy'
import styles from './Tray.module.css'

/** Marca do AgileBox (três colunas), igual ao SVG do protótipo. */
export function BrandMark({ size = 12 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h7v10H4z" />
      <path d="M13 4h7v7h-7z" />
      <path d="M13 14h7v6h-7z" />
    </svg>
  )
}

export function OpenPanelButton({ label = trayCopy.openFullPanel }: { readonly label?: string }) {
  return (
    <button
      type="button"
      className={styles.iconBtn}
      aria-label={label}
      title={label}
      onClick={() => window.agilebox.shell.openPanel()}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    </button>
  )
}

export function CollapseButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.iconBtn}
      aria-label={trayCopy.collapseToPrompt}
      title={trayCopy.collapseToPrompt}
      onClick={onClick}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
      </svg>
    </button>
  )
}

export interface TrayHeaderProps {
  readonly left: ReactNode
  readonly actions: ReactNode
}

/** Cabeçalho de 42px das telas expandidas (.tray-header). */
export function TrayHeader({ left, actions }: TrayHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>{left}</div>
      <div className={styles.headerActions}>{actions}</div>
    </header>
  )
}

export interface BackButtonProps {
  readonly onClick: () => void
  /** Só a seta (28×28), com rótulo acessível. Sem isso, mostra "← Voltar". */
  readonly iconOnly?: boolean
  readonly label?: string
}

export function BackButton({ onClick, iconOnly = false, label }: BackButtonProps) {
  return iconOnly ? (
    <button
      type="button"
      className={`${styles.backBtn} ${styles.backBtnSquare}`}
      aria-label={label ?? trayCopy.back}
      onClick={onClick}
    >
      ←
    </button>
  ) : (
    <button type="button" className={styles.backBtn} onClick={onClick}>
      {trayCopy.backWithArrow}
    </button>
  )
}
