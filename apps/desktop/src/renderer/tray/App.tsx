import { useEffect, useReducer, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Toast, useReducedMotion } from '@agilebox/ui'
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
  const [dailyDismissed, setDailyDismissed] = useState(false)
  const [phraseSeed, setPhraseSeed] = useState(0)

  // A barra da daily só existe com a ferramenta de check-ins; sem ela nada é pedido ao backend.
  const capabilities = useCapabilities()
  const dailyVisible = capabilities.can('checkins:screen')
  const daily = useDailyToday(capabilities.canFetch('checkins:screen'))
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

  // Encerrando, a daily de hoje não pode ser criada: sem ela, a barra some.
  const dailyCreationBlocked =
    capabilities.isWindingDown('checkins') && daily.data !== undefined && daily.data.entry === null
  const dailyBarAvailable = dailyVisible && Boolean(daily.data?.due) && !dailyCreationBlocked

  const width = autoWidth(screen.kind)
  const height = autoHeight(screen.kind)
  const reducedMotion = useReducedMotion()
  const sentSize = useRef<{ width: number; height: number } | null>(null)

  // Janela do protótipo: width/height 240ms ease-ios. Sem animação com movimento reduzido.
  useEffect(() => {
    const send = (nextHeight: number, nextWidth: number) => {
      sentSize.current = { width: nextWidth, height: nextHeight }
      window.agilebox.shell.setTrayHeight({ height: nextHeight, width: nextWidth })
    }
    const from = sentSize.current
    const animate =
      from !== null &&
      (from.width !== width || from.height !== height) &&
      !reducedMotion &&
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
      send(tweenHeight(from.height, height, progress), tweenHeight(from.width, width, progress))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [height, width, reducedMotion])

  const collapse = () => {
    setPhraseSeed((seed) => seed + 1)
    dispatch({ type: 'collapse' })
  }
  const back = () => dispatch({ type: 'back' })

  if (screen.kind === 'prompt') {
    return (
      <main className={`${styles.window} ${styles.windowCompact}`} aria-label={trayCopy.label}>
        <PromptScreen
          openCount={openFocusCount}
          phraseSeed={phraseSeed}
          onExpand={() => dispatch({ type: 'expand' })}
        />
        {state.notice ? <Toast message={state.notice} /> : null}
      </main>
    )
  }

  return (
    <main className={styles.window} aria-label={trayCopy.label}>
      <section
        key={screen.kind + ('taskId' in screen ? screen.taskId : '')}
        className={styles.screen}
      >
        {screen.kind === 'home' ? (
          <HomeScreen
            dailyBarAvailable={dailyBarAvailable}
            dailyDismissed={dailyDismissed}
            onStartDaily={() => dispatch({ type: 'openDaily' })}
            onDismissDaily={() => setDailyDismissed(true)}
            onOpenTask={(taskId) => dispatch({ type: 'openTask', taskId })}
            onNewTask={() => dispatch({ type: 'newTask' })}
            onCreated={(taskId) => dispatch({ type: 'taskCreated', taskId })}
            onOpenKan={() => dispatch({ type: 'openKan' })}
            onCollapse={collapse}
          />
        ) : screen.kind === 'kan' ? (
          <KanChatScreen onBack={back} onCollapse={collapse} />
        ) : screen.kind === 'new' ? (
          <NewTaskScreen
            onCreated={(taskId) => dispatch({ type: 'taskCreated', taskId })}
            onBack={back}
          />
        ) : screen.kind === 'daily' ? (
          <DailyScreen onSaved={() => dispatch({ type: 'dailySaved' })} onBack={back} />
        ) : (
          <UpdateTaskScreen
            taskId={screen.taskId}
            onSaved={() => dispatch({ type: 'saved', taskId: screen.taskId })}
            onBack={back}
          />
        )}
      </section>
      {state.notice ? <Toast message={state.notice} /> : null}
    </main>
  )
}
