import { useCallback, useEffect, useReducer, useState } from 'react'
import { Button, Toast, WindowControls } from '@agilebox/ui'
import { autoHeight, TRAY_COLLAPSED_HEIGHT } from './auto-height'
import { trayCopy } from './copy'
import { HomeScreen } from './screens/HomeScreen'
import { NewTaskScreen } from './screens/NewTaskScreen'
import { UpdateTaskScreen } from './screens/UpdateTaskScreen'
import { ResizeHandle } from './ResizeHandle'
import { initialTrayState, trayReducer } from './tray-machine'
import styles from './Tray.module.css'

export function App() {
  const [state, dispatch] = useReducer(trayReducer, initialTrayState)
  const [visibleTasks, setVisibleTasks] = useState(2)
  const [manualHeight, setManualHeight] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const { screen } = state

  const automatic = autoHeight(screen.kind, visibleTasks)
  const height = collapsed ? TRAY_COLLAPSED_HEIGHT : (manualHeight ?? automatic)

  useEffect(() => {
    window.agilebox.shell.setTrayHeight({ height })
  }, [height])

  // Mudar de tela volta ao tamanho automático daquela tela.
  const screenKey = screen.kind
  useEffect(() => {
    setManualHeight(null)
  }, [screenKey])

  const onVisibleCount = useCallback((count: number) => setVisibleTasks(count), [])

  return (
    <main
      className={`${styles.window} ${collapsed ? styles.collapsed : ''}`}
      aria-label={trayCopy.label}
      data-dragging={dragging}
    >
      <ResizeHandle height={height} onResize={setManualHeight} onDragChange={setDragging} />
      <header className={styles.header}>
        {screen.kind === 'home' ? (
          <h1>{trayCopy.title}</h1>
        ) : (
          <Button type="button" onClick={() => dispatch({ type: 'back' })}>
            ← {trayCopy.back}
          </Button>
        )}
        <WindowControls
          expanded={false}
          onMinimize={() => setCollapsed((value) => !value)}
          onToggleExpand={() => window.agilebox.shell.openPanel()}
          onClose={() => window.agilebox.shell.close()}
        />
      </header>
      {collapsed ? null : (
        <div
          key={screen.kind + ('taskId' in screen ? screen.taskId : '')}
          className={`${styles.screen} ${state.direction === 'forward' ? styles.slideForward : styles.slideBack}`}
        >
          {screen.kind === 'home' ? (
            <HomeScreen
              highlightTaskId={state.highlightTaskId}
              onOpenTask={(taskId) => dispatch({ type: 'openTask', taskId })}
              onNewTask={() => dispatch({ type: 'newTask' })}
              onVisibleCount={onVisibleCount}
            />
          ) : screen.kind === 'new' ? (
            <NewTaskScreen onCreated={(taskId) => dispatch({ type: 'taskCreated', taskId })} />
          ) : (
            <UpdateTaskScreen
              taskId={screen.taskId}
              onSaved={() => dispatch({ type: 'saved', taskId: screen.taskId })}
            />
          )}
        </div>
      )}
      {state.notice ? <Toast message={state.notice} /> : null}
    </main>
  )
}
