import { useEffect, useState } from 'react'
import { useReducedMotion } from '@agilebox/ui'
import { TRAY_PROMPT_PHRASES, trayCopy } from '../copy'
import styles from '../Tray.module.css'

export interface PromptScreenProps {
  readonly openCount: number | null
  readonly phraseSeed?: number
  readonly onExpand: () => void
  readonly onOpenPanel: () => void
}

export function PromptScreen({
  openCount,
  phraseSeed = 0,
  onExpand,
  onOpenPanel,
}: PromptScreenProps) {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(() => phraseSeed % TRAY_PROMPT_PHRASES.length)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    setIndex(phraseSeed % TRAY_PROMPT_PHRASES.length)
  }, [phraseSeed])

  useEffect(() => {
    if (paused || reducedMotion) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % TRAY_PROMPT_PHRASES.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [paused, reducedMotion])

  const phrase = TRAY_PROMPT_PHRASES[index] ?? TRAY_PROMPT_PHRASES[0]
  const subtitle =
    openCount === null || openCount <= 0
      ? trayCopy.promptSubEmpty
      : openCount === 1
        ? trayCopy.promptSubOne
        : trayCopy.promptSubMany(openCount)

  return (
    <div
      className={styles.promptShell}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <button
        type="button"
        className={styles.promptMain}
        aria-label={trayCopy.promptExpandAria}
        onClick={onExpand}
      >
        <span className={styles.promptDot} aria-hidden="true">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          >
            <path d="M4 7h7v10H4z" />
            <path d="M13 4h7v7h-7z" />
            <path d="M13 14h7v6h-7z" />
          </svg>
        </span>
        <span className={styles.promptCopy}>
          <span className={styles.promptPhrase}>{phrase}</span>
          <span className={styles.promptSub}>{subtitle}</span>
        </span>
      </button>
      <div className={styles.promptActions}>
        <button
          type="button"
          className={styles.trayIconBtn}
          aria-label={trayCopy.openFullPanel}
          title={trayCopy.openFullPanel}
          onClick={onOpenPanel}
        >
          <svg
            width="15"
            height="15"
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
      </div>
    </div>
  )
}
