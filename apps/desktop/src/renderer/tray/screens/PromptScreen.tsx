import { useEffect, useState } from 'react'
import { useReducedMotion } from '@agilebox/ui'
import { TRAY_PROMPT_PHRASES, trayCopy } from '../copy'
import { BrandMark, OpenPanelButton } from '../TrayHeader'
import styles from '../Tray.module.css'

export interface PromptScreenProps {
  readonly openCount: number | null
  readonly phraseSeed?: number
  readonly onExpand: () => void
}

/** Estado 1: aviso compacto (.tray-prompt-shell). A frase troca a cada 6s com fade de 160ms. */
export function PromptScreen({ openCount, phraseSeed = 0, onExpand }: PromptScreenProps) {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(() => phraseSeed % TRAY_PROMPT_PHRASES.length)
  const [shownIndex, setShownIndex] = useState(index)
  const [fading, setFading] = useState(false)
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

  useEffect(() => {
    if (index === shownIndex) return
    if (reducedMotion) {
      setShownIndex(index)
      setFading(false)
      return
    }
    setFading(true)
    const timer = window.setTimeout(() => {
      setShownIndex(index)
      setFading(false)
    }, 160)
    return () => window.clearTimeout(timer)
  }, [index, shownIndex, reducedMotion])

  const phrase = TRAY_PROMPT_PHRASES[shownIndex] ?? TRAY_PROMPT_PHRASES[0]
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
        <span className={`${styles.brandDot} ${styles.promptDotWrap}`} aria-hidden="true">
          <BrandMark />
        </span>
        <span className={styles.promptCopy}>
          <span className={`${styles.promptPhrase} ${fading ? styles.promptPhraseFading : ''}`}>
            {phrase}
          </span>
          <span className={styles.promptSub}>{subtitle}</span>
        </span>
      </button>
      <div className={styles.promptActions}>
        <OpenPanelButton />
      </div>
    </div>
  )
}
