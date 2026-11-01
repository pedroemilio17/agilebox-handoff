import { useId, useState } from 'react'
import { Button, GlassSurface, SegmentedControl } from '@agilebox/ui'
import type { AppearanceMode } from '@agilebox/contract'
import {
  readWindowOpacity,
  saveWindowOpacity,
  WINDOW_OPACITY_DEFAULT,
  WINDOW_OPACITY_MAX,
  WINDOW_OPACITY_MIN,
} from '../../shared/lib/window-opacity'
import { panelCopy } from '../copy'
import { UpdatesSection } from './UpdatesSection'
import styles from './SettingsView.module.css'

const percent = (value: number) => Math.round(value * 100)

/** Ao recriar as janelas o painel volta aberto em Ajustes (ver App). */
export const REOPEN_SETTINGS_KEY = 'agilebox.reopenSettings'

const currentAppearance = (): AppearanceMode =>
  document.documentElement.dataset.glass === 'opaque' ? 'opaque' : 'translucent'

export function SettingsView() {
  const [opacity, setOpacity] = useState(readWindowOpacity)
  const [appearance, setAppearance] = useState<AppearanceMode>(currentAppearance)
  const sliderId = useId()
  const hintId = useId()

  return (
    <div className={styles.view}>
      <GlassSurface variant="group" className={styles.section} aria-label={panelCopy.appearance}>
        <h2 className={styles.sectionTitle}>{panelCopy.appearance}</h2>
        <span className={styles.label}>{panelCopy.windowBackground}</span>
        <SegmentedControl<AppearanceMode>
          aria-label={panelCopy.windowBackground}
          value={appearance}
          onChange={(mode) => {
            if (mode === appearance) return
            setAppearance(mode)
            try {
              window.localStorage.setItem(REOPEN_SETTINGS_KEY, '1')
            } catch {
              // Sem armazenamento o painel reabre no quadro.
            }
            window.agilebox.shell.setAppearance({ mode })
          }}
          options={[
            { value: 'translucent', label: panelCopy.translucent },
            { value: 'opaque', label: panelCopy.opaque },
          ]}
        />
        <p className={styles.hint}>{panelCopy.windowBackgroundHint}</p>
        <div className={styles.row}>
          <label htmlFor={sliderId} className={styles.label}>
            {panelCopy.windowOpacity}
          </label>
          <output htmlFor={sliderId} className={styles.value}>
            {percent(opacity)}%
          </output>
        </div>
        <input
          id={sliderId}
          className={styles.slider}
          type="range"
          min={percent(WINDOW_OPACITY_MIN)}
          max={percent(WINDOW_OPACITY_MAX)}
          step={1}
          value={percent(opacity)}
          aria-describedby={hintId}
          aria-valuetext={`${percent(opacity)}%`}
          disabled={appearance === 'opaque'}
          onChange={(event) =>
            setOpacity(saveWindowOpacity(Number(event.currentTarget.value) / 100))
          }
        />
        <p id={hintId} className={styles.hint}>
          {appearance === 'opaque' ? panelCopy.opacityOnlyTranslucent : panelCopy.windowOpacityHint}
        </p>
        <div>
          <Button
            type="button"
            disabled={appearance === 'opaque' || opacity === WINDOW_OPACITY_DEFAULT}
            onClick={() => setOpacity(saveWindowOpacity(WINDOW_OPACITY_DEFAULT))}
          >
            {panelCopy.restoreDefault}
          </Button>
        </div>
      </GlassSurface>
      <UpdatesSection />
    </div>
  )
}
