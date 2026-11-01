import { useId, useState } from 'react'
import { Button, GlassSurface } from '@agilebox/ui'
import {
  readWindowOpacity,
  saveWindowOpacity,
  WINDOW_OPACITY_DEFAULT,
  WINDOW_OPACITY_MAX,
  WINDOW_OPACITY_MIN,
} from '../../shared/lib/window-opacity'
import { panelCopy } from '../copy'
import styles from './SettingsView.module.css'

const percent = (value: number) => Math.round(value * 100)

export function SettingsView() {
  const [opacity, setOpacity] = useState(readWindowOpacity)
  const sliderId = useId()
  const hintId = useId()

  return (
    <div className={styles.view}>
      <GlassSurface variant="group" className={styles.section} aria-label={panelCopy.appearance}>
        <h2 className={styles.sectionTitle}>{panelCopy.appearance}</h2>
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
          onChange={(event) =>
            setOpacity(saveWindowOpacity(Number(event.currentTarget.value) / 100))
          }
        />
        <p id={hintId} className={styles.hint}>
          {panelCopy.windowOpacityHint}
        </p>
        <div>
          <Button
            type="button"
            disabled={opacity === WINDOW_OPACITY_DEFAULT}
            onClick={() => setOpacity(saveWindowOpacity(WINDOW_OPACITY_DEFAULT))}
          >
            {panelCopy.restoreDefault}
          </Button>
        </div>
      </GlassSurface>
    </div>
  )
}
