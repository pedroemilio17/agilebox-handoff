import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { GlassToast } from '@agilebox/ui'
import styles from './UndoProvider.module.css'

export const UNDO_FAILED_MESSAGE = 'Não foi possível desfazer. Tente de novo.'
/** O alerta de erro some sozinho depois deste tempo (ou quando sai um aviso novo). */
const FAILURE_MS = 5000

export interface UndoOffer {
  /** Texto do aviso, com o nome do item, por exemplo "Tarefa “Revisar” arquivada". */
  readonly message: string
  /** Desfaz a ação. Se a promessa falhar, aparece o alerta de erro. */
  readonly undo: () => Promise<unknown>
}

interface QueuedUndo extends UndoOffer {
  readonly id: number
}

interface UndoContextValue {
  /** Entra na fila de desfazer. Um aviso mostrado não é apagado pelo novo: ele espera a vez. */
  readonly offer: (offer: UndoOffer) => void
}

const UndoContext = createContext<UndoContextValue | null>(null)

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
      null
  )
}

/**
 * Avisos de desfazer compartilhados pelo painel (M2.12). Fica acima do conteúdo para sobreviver
 * ao fechamento do detalhe: arquivar uma tarefa fecha o detalhe, e o aviso continua na tela.
 * Um aviso por vez, em ordem de chegada: o próximo só aparece quando o atual for desfeito ou
 * expirar, para que nenhum item arquivado perca o botão de desfazer.
 * Ctrl Z desfaz o aviso visível quando o foco não está em campo de texto (ali, Ctrl Z é do campo).
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<readonly QueuedUndo[]>([])
  const [failed, setFailed] = useState(false)
  // Espelha a fila: dois Ctrl Z seguidos não podem desfazer o mesmo aviso duas vezes.
  const queueRef = useRef<readonly QueuedUndo[]>([])
  const nextId = useRef(0)
  const visible = queue[0]

  const replaceQueue = useCallback((next: readonly QueuedUndo[]) => {
    queueRef.current = next
    setQueue(next)
  }, [])

  const offer = useCallback(
    (next: UndoOffer) => {
      nextId.current += 1
      setFailed(false)
      replaceQueue([...queueRef.current, { ...next, id: nextId.current }])
    },
    [replaceQueue],
  )

  const dismiss = useCallback(
    (id: number) => {
      if (!queueRef.current.some((entry) => entry.id === id)) return
      replaceQueue(queueRef.current.filter((entry) => entry.id !== id))
    },
    [replaceQueue],
  )

  const runUndo = useCallback(
    (id: number) => {
      const entry = queueRef.current.find((item) => item.id === id)
      if (!entry) return
      replaceQueue(queueRef.current.filter((item) => item.id !== id))
      setFailed(false)
      entry.undo().catch(() => setFailed(true))
    },
    [replaceQueue],
  )

  const hasVisible = visible !== undefined
  useEffect(() => {
    if (!hasVisible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== 'z' ||
        isEditable(event.target)
      )
        return
      const first = queueRef.current[0]
      if (!first) return
      event.preventDefault()
      runUndo(first.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasVisible, runUndo])

  useEffect(() => {
    if (!failed) return
    const timer = window.setTimeout(() => setFailed(false), FAILURE_MS)
    return () => window.clearTimeout(timer)
  }, [failed])

  const value = useMemo(() => ({ offer }), [offer])

  return (
    <UndoContext.Provider value={value}>
      {children}
      {visible ? (
        <GlassToast
          key={visible.id}
          message={visible.message}
          actionLabel="Desfazer"
          actionShortcut="Ctrl Z"
          onAction={() => runUndo(visible.id)}
          onDismiss={() => dismiss(visible.id)}
        />
      ) : null}
      {failed ? (
        <p role="alert" className={styles.failure}>
          {UNDO_FAILED_MESSAGE}
        </p>
      ) : null}
    </UndoContext.Provider>
  )
}

export function useUndo(): UndoContextValue {
  const context = useContext(UndoContext)
  if (!context) throw new Error('useUndo precisa de um UndoProvider acima')
  return context
}
