import { useRef } from 'react'
import { TRAY_KEYBOARD_STEP, TRAY_MAX_HEIGHT, TRAY_MIN_HEIGHT, clampHeight } from './auto-height'
import { trayCopy } from './copy'
import styles from './Tray.module.css'

export interface ResizeHandleProps {
  readonly height: number
  /** Altura manual em pixels; `null` volta ao automático. */
  readonly onResize: (height: number | null) => void
  readonly onDragChange?: (dragging: boolean) => void
}

// A bandeja fica ancorada embaixo: arrastar para cima aumenta a altura.
export function ResizeHandle({ height, onResize, onDragChange }: ResizeHandleProps) {
  const drag = useRef<{ startY: number; startHeight: number } | null>(null)

  return (
    <div
      className={styles.resizeHandle}
      role="separator"
      aria-orientation="horizontal"
      aria-label={trayCopy.resizeHandle}
      aria-valuemin={TRAY_MIN_HEIGHT}
      aria-valuemax={TRAY_MAX_HEIGHT}
      aria-valuenow={height}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { startY: event.screenY, startHeight: height }
        onDragChange?.(true)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        onResize(clampHeight(drag.current.startHeight + (drag.current.startY - event.screenY)))
      }}
      onPointerUp={() => {
        drag.current = null
        onDragChange?.(false)
      }}
      onPointerCancel={() => {
        drag.current = null
        onDragChange?.(false)
      }}
      onDoubleClick={() => onResize(null)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault()
          onResize(clampHeight(height + TRAY_KEYBOARD_STEP))
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault()
          onResize(clampHeight(height - TRAY_KEYBOARD_STEP))
        } else if (event.key === 'Home') {
          event.preventDefault()
          onResize(null)
        }
      }}
    >
      <span aria-hidden="true" />
    </div>
  )
}
