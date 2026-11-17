import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Button, Toast, WindowControls, useReducedMotion } from '@agilebox/ui'
import {
  autoHeight,
  tweenHeight,
  TRAY_COLLAPSED_HEIGHT,
  TRAY_HEIGHT_DURATION_MS,
} from './auto-height'
import { trayCopy } from './copy'
import { useDailyToday } from './use-daily-today'
import { CapabilitiesProvider } from '../shared/capabilities/CapabilitiesProvider'
import { useCapabilities } from '../shared/capabilities/capabilities-context'
import { DailyScreen } from './screens/DailyScreen'
import { HomeScreen } from './screens/HomeScreen'
import { NewTaskScreen } from './screens/NewTaskScreen'
import { UpdateTaskScreen } from './screens/UpdateTaskScreen'
import { ResizeHandle } from './ResizeHandle'
import { initialTrayState, trayReducer } from './tray-machine'
import styles from './Tray.module.css'

export function App() {
  return (
    <CapabilitiesProvider>
      <TrayContent />
    </CapabilitiesProvider>
  )
}

function TrayContent() {
  const [state, dispatch] = useReducer(trayReducer, initialTrayState)
  const [visibleTasks, setVisibleTasks] = useState(2)
  const [manualHeight, setManualHeight] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dailyDismissed, setDailyDismissed] = useState(false)
  // Cartão e passos da daily só com a ferramenta de check-ins; sem ela nada é pedido ao backend.
  const capabilities = useCapabilities()
  const dailyVisible = capabilities.can('checkins:screen')
  const daily = useDailyToday(capabilities.canFetch('checkins:screen'))
  // Sair da daily (Voltar ou Esc) passa pela guarda da tela, que pede confirmação se houver texto.
  const dailyExit = useRef<(() => void) | null>(null)
  const { screen } = state
  // Encerrando, a daily de hoje não pode ser criada: sem ela, o convite e o atalho somem. A que já
  // existe segue editável (PLANO-2.0, regra 4), por isso o atalho continua quando há entrada.
  const dailyCreationBlocked =
    capabilities.isWindingDown('checkins') && daily.data !== undefined && daily.data.entry === null
  const inviteVisible =
    dailyVisible && Boolean(daily.data?.due) && !dailyDismissed && !dailyCreationBlocked

  const automatic = autoHeight(screen.kind, visibleTasks, inviteVisible)
  const height = collapsed ? TRAY_COLLAPSED_HEIGHT : (manualHeight ?? automatic)
  const reducedMotion = useReducedMotion()
  // Última altura enviada à janela; a transição parte dela, mesmo se for interrompida.
  const sentHeight = useRef<number | null>(null)

  useEffect(() => {
    const send = (value: number) => {
      sentHeight.current = value
      window.agilebox.shell.setTrayHeight({ height: value })
    }
    const from = sentHeight.current
    // Só mudanças automáticas (troca de tela, linhas visíveis) animam; arrastar, teclado e recolher são imediatos.
    const animate =
      from !== null &&
      from !== height &&
      manualHeight === null &&
      !collapsed &&
      !dragging &&
      !reducedMotion &&
      typeof requestAnimationFrame === 'function'
    if (!animate) {
      send(height)
      return
    }
    const start = performance.now()
    let frame = 0
    const step = () => {
      const progress = (performance.now() - start) / TRAY_HEIGHT_DURATION_MS
      if (progress >= 1) {
        send(height)
        return
      }
      send(tweenHeight(from, height, progress))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [height, manualHeight, collapsed, dragging, reducedMotion])

  // Mudar de tela volta ao tamanho automático daquela tela.
  const screenKey = screen.kind
  useEffect(() => {
    setManualHeight(null)
  }, [screenKey])

  const onVisibleCount = useCallback((count: number) => setVisibleTasks(count), [])

  const goBack = () => {
    if (dailyExit.current) dailyExit.current()
    else dispatch({ type: 'back' })
  }

  return (
    <main
      className={`${styles.window} ${collapsed ? styles.collapsed : ''}`}
      aria-label={trayCopy.label}
      data-dragging={dragging}
    >
      <ResizeHandle height={height} onResize={setManualHeight} onDragChange={setDragging} />
      <header className={styles.header}>
        {screen.kind === 'home' ? (
          <h1 className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              A
            </span>
            {trayCopy.title}
          </h1>
        ) : (
          <Button type="button" onClick={goBack}>
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
              daily={dailyVisible && !dailyCreationBlocked ? daily.data : undefined}
              inviteVisible={inviteVisible}
              onStartDaily={() => dispatch({ type: 'openDaily' })}
              onDismissDaily={() => setDailyDismissed(true)}
              onOpenTask={(taskId) => dispatch({ type: 'openTask', taskId })}
              onNewTask={() => dispatch({ type: 'newTask' })}
              onCreated={(taskId) => dispatch({ type: 'taskCreated', taskId })}
              onVisibleCount={onVisibleCount}
            />
          ) : screen.kind === 'new' ? (
            <NewTaskScreen onCreated={(taskId) => dispatch({ type: 'taskCreated', taskId })} />
          ) : screen.kind === 'daily' ? (
            <DailyScreen
              onSaved={() => dispatch({ type: 'dailySaved' })}
              onExit={() => dispatch({ type: 'back' })}
              exitRef={dailyExit}
            />
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
