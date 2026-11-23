import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Toast, useReducedMotion } from '@agilebox/ui'
import kanClosedUrl from '../shared/assets/kan-closed.png'
import kanOpenUrl from '../shared/assets/kan-open.png'
import { useApi } from '../shared/api/ApiProvider'
import { CapabilitiesProvider } from '../shared/capabilities/CapabilitiesProvider'
import { useCapabilities } from '../shared/capabilities/capabilities-context'
import { queryKeys } from '../shared/query/keys'
import { useActor } from '../shared/session/useActor'
import { autoHeight, autoWidth, tweenHeight, TRAY_HEIGHT_DURATION_MS } from './auto-height'
import { trayCopy } from './copy'
import { useDailyToday } from './use-daily-today'
import { DailyScreen } from './screens/DailyScreen'
import { HomeScreen } from './screens/HomeScreen'
import { KanChatScreen } from './screens/KanChatScreen'
import { NewTaskScreen } from './screens/NewTaskScreen'
import { PromptScreen } from './screens/PromptScreen'
import { UpdateTaskScreen } from './screens/UpdateTaskScreen'
import { ResizeHandle } from './ResizeHandle'
import { createInitialTrayState, trayReducer } from './tray-machine'
import styles from './Tray.module.css'

export interface TrayAppProps {
  readonly initialScreen?: 'prompt' | 'home'
}

export function App({ initialScreen = 'prompt' }: TrayAppProps = {}) {
  return (
    <CapabilitiesProvider>
      <TrayContent initialScreen={initialScreen} />
    </CapabilitiesProvider>
  )
}

function TrayContent({ initialScreen }: { readonly initialScreen: 'prompt' | 'home' }) {
  const api = useApi()
  const actor = useActor()
  const [state, dispatch] = useReducer(trayReducer, initialScreen, createInitialTrayState)
  const [visibleTasks, setVisibleTasks] = useState(2)
  const [manualHeight, setManualHeight] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dailyDismissed, setDailyDismissed] = useState(false)
  const [phraseSeed, setPhraseSeed] = useState(0)

  // Cartão e passos da daily só com a ferramenta de check-ins; sem ela nada é pedido ao backend.
  const capabilities = useCapabilities()
  const dailyVisible = capabilities.can('checkins:screen')
  const daily = useDailyToday(capabilities.canFetch('checkins:screen'))
  // Sair da daily (Voltar, Esc ou Recolher) passa pela guarda da tela, que pede confirmação se houver texto.
  const dailyExit = useRef<(() => void) | null>(null)
  const exitKind = useRef<'back' | 'collapse'>('back')
  const { screen } = state

  const boardFocus = useQuery({
    queryKey: queryKeys.tasks.board(undefined, actor.actor?.userId),
    enabled: Boolean(actor.actor) && screen.kind === 'prompt',
    queryFn: () =>
      api.tasks.listBoard(actor.actor?.role === 'manager' ? { forUserId: actor.actor.userId } : {}),
  })
  const recentFocus = useQuery({
    queryKey: [...queryKeys.tasks.all, 'tray', 'recent'],
    enabled: screen.kind === 'prompt',
    queryFn: () => api.tasks.listRecent(),
  })

  const promptSource =
    (boardFocus.data?.tasks?.length ?? 0) > 0 ? boardFocus.data?.tasks : recentFocus.data
  const openFocusCount = promptSource
    ? promptSource.filter((task) => task.status !== 'done' && !task.archivedAt).length
    : null

  // Encerrando, a daily de hoje não pode ser criada: sem ela, o convite e o atalho somem. A que já
  // existe segue editável (PLANO-2.0, regra 4), por isso o atalho continua quando há entrada.
  const dailyCreationBlocked =
    capabilities.isWindingDown('checkins') && daily.data !== undefined && daily.data.entry === null
  const inviteVisible =
    dailyVisible && Boolean(daily.data?.due) && !dailyDismissed && !dailyCreationBlocked

  const width = autoWidth(screen.kind)
  const height =
    screen.kind === 'prompt'
      ? autoHeight('prompt', visibleTasks, false)
      : (manualHeight ?? autoHeight(screen.kind, visibleTasks, inviteVisible))
  const reducedMotion = useReducedMotion()
  const sentSize = useRef<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const send = (nextHeight: number, nextWidth: number) => {
      sentSize.current = { width: nextWidth, height: nextHeight }
      window.agilebox.shell.setTrayHeight({ height: nextHeight, width: nextWidth })
    }
    const from = sentSize.current
    const animate =
      from !== null &&
      from.width === width &&
      from.height !== height &&
      manualHeight === null &&
      !dragging &&
      !reducedMotion &&
      screen.kind !== 'prompt' &&
      typeof requestAnimationFrame === 'function'
    if (!animate) {
      send(height, width)
      return
    }
    const start = performance.now()
    let frame = 0
    const step = () => {
      const progress = (performance.now() - start) / TRAY_HEIGHT_DURATION_MS
      if (progress >= 1) {
        send(height, width)
        return
      }
      send(tweenHeight(from.height, height, progress), width)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [height, width, manualHeight, dragging, reducedMotion, screen.kind])

  // Mudar de tela volta ao tamanho automático daquela tela.
  const screenKey = screen.kind
  useEffect(() => {
    setManualHeight(null)
  }, [screenKey])

  const onVisibleCount = useCallback((count: number) => setVisibleTasks(count), [])

  const triggerExit = (kind: 'back' | 'collapse') => {
    exitKind.current = kind
    if (screen.kind === 'daily' && dailyExit.current) {
      dailyExit.current()
      return
    }
    if (kind === 'collapse') {
      setPhraseSeed((seed) => seed + 1)
      dispatch({ type: 'collapse' })
    } else {
      dispatch({ type: 'back' })
    }
  }

  const openFullPanel = () => window.agilebox.shell.openPanel()

  if (screen.kind === 'prompt') {
    return (
      <main className={`${styles.window} ${styles.windowCompact}`} aria-label={trayCopy.label}>
        <PromptScreen
          openCount={openFocusCount}
          phraseSeed={phraseSeed}
          onExpand={() => dispatch({ type: 'expand' })}
          onOpenPanel={openFullPanel}
        />
        {state.notice ? <Toast message={state.notice} /> : null}
      </main>
    )
  }

  return (
    <main className={styles.window} aria-label={trayCopy.label} data-dragging={dragging}>
      <ResizeHandle height={height} onResize={setManualHeight} onDragChange={setDragging} />
      <header className={styles.header}>
        {screen.kind === 'home' ? (
          <h1 className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              A
            </span>
            {trayCopy.title}
          </h1>
        ) : screen.kind === 'kan' ? (
          <div className={styles.kanHeaderLeft}>
            <Button type="button" aria-label={trayCopy.back} onClick={() => triggerExit('back')}>
              ←
            </Button>
            <img src={kanOpenUrl} alt="" className={styles.kanAvatar} aria-hidden="true" />
            <h1>{trayCopy.kanTitle}</h1>
          </div>
        ) : (
          <Button type="button" onClick={() => triggerExit('back')}>
            ← {trayCopy.back}
          </Button>
        )}
        <div className={styles.trayHeaderActions} role="group" aria-label="Controles da bandeja">
          {screen.kind === 'home' ? (
            <button
              type="button"
              className={styles.trayKanBtn}
              aria-label={trayCopy.openKan}
              title={trayCopy.openKan}
              onClick={() => dispatch({ type: 'openKan' })}
            >
              <img src={kanClosedUrl} alt="" className={styles.trayKanMini} aria-hidden="true" />
              <span>{trayCopy.kanTitle}</span>
            </button>
          ) : null}
          <button
            type="button"
            className={styles.trayIconBtn}
            aria-label={trayCopy.collapseToPrompt}
            title={trayCopy.collapseToPrompt}
            onClick={() => triggerExit('collapse')}
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
          <button
            type="button"
            className={styles.trayIconBtn}
            aria-label={trayCopy.openFullPanel}
            title={trayCopy.openFullPanel}
            onClick={openFullPanel}
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
          <button
            type="button"
            className={`${styles.trayIconBtn} ${styles.trayIconBtnClose}`}
            aria-label={trayCopy.closeWindow}
            title={trayCopy.closeWindow}
            onClick={() => window.agilebox.shell.close()}
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
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>
      </header>
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
        ) : screen.kind === 'kan' ? (
          <KanChatScreen />
        ) : screen.kind === 'new' ? (
          <NewTaskScreen onCreated={(taskId) => dispatch({ type: 'taskCreated', taskId })} />
        ) : screen.kind === 'daily' ? (
          <DailyScreen
            onSaved={() => dispatch({ type: 'dailySaved' })}
            onExit={() => {
              if (exitKind.current === 'collapse') {
                setPhraseSeed((seed) => seed + 1)
                dispatch({ type: 'collapse' })
              } else {
                dispatch({ type: 'back' })
              }
            }}
            exitRef={dailyExit}
          />
        ) : (
          <UpdateTaskScreen
            taskId={screen.taskId}
            onSaved={() => dispatch({ type: 'saved', taskId: screen.taskId })}
          />
        )}
      </div>
      {state.notice ? <Toast message={state.notice} /> : null}
    </main>
  )
}
