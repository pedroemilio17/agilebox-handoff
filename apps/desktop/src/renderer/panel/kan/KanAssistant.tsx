import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ProjectDto, SessionUserDto, TaskDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import type { PanelView } from '../layout/PanelShell'
import kanClosedUrl from './assets/kan_fechado.png'
import kanOpenUrl from './assets/kan_aberto.png'
import { mountKan3D, type Kan3DController } from './kan-3d'
import {
  confirmKanPendingAction,
  getKanApiKey,
  getKanModel,
  isKanActionUndone,
  KAN_MODELS,
  loadKanChatHistory,
  saveKanChatHistory,
  sendKanMessage,
  setKanApiKey,
  setKanModel,
  testKanApiKey,
  undoKanAction,
  type KanChatMessage,
  type KanConfirmationRequest,
  type KanRuntimeContext,
} from './kan-ai'
import { getKanScreenGuide, KAN_CHECKLISTS, KAN_FAQ_ITEMS } from './kan-content'
import styles from './KanAssistant.module.css'

export type KanTab = 'chat' | 'screen' | 'steps' | 'faq'

const STORAGE_POS = 'agilebox_kan_pos'
const STORAGE_TAB = 'agilebox_kan_tab'
const STORAGE_STEPS = 'agilebox_kan_steps'

interface Point {
  readonly left: number
  readonly top: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function defaultFabPos(): Point {
  const vw = window.innerWidth || 1280
  const vh = window.innerHeight || 780
  return {
    left: Math.max(8, vw - 112 - 14),
    top: Math.max(48, vh - 112 - 12),
  }
}

function loadFabPos(): Point {
  try {
    const raw = window.localStorage.getItem(STORAGE_POS)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Point>
      if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
        const vw = window.innerWidth || 1280
        const vh = window.innerHeight || 780
        return {
          left: clamp(parsed.left, 8, Math.max(8, vw - 120)),
          top: clamp(parsed.top, 48, Math.max(48, vh - 120)),
        }
      }
    }
  } catch {
    /* ignore */
  }
  return defaultFabPos()
}

function loadSavedTab(): KanTab {
  try {
    const raw = window.localStorage.getItem(STORAGE_TAB)
    if (raw === 'chat' || raw === 'screen' || raw === 'steps' || raw === 'faq') return raw
  } catch {
    /* ignore */
  }
  return 'chat'
}

function loadCompletedSteps(role: 'collaborator' | 'manager'): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_STEPS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const list = parsed[role]
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveCompletedSteps(role: 'collaborator' | 'manager', ids: readonly string[]): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_STEPS)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    parsed[role] = [...ids]
    window.localStorage.setItem(STORAGE_STEPS, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

function computeDrawerPos(fabPos: Point, drawerHeight: number): Point {
  const vw = window.innerWidth || 1280
  const vh = window.innerHeight || 780
  const drawerW = Math.min(368, vw - 24)
  const drawerH = drawerHeight || Math.max(360, Math.min(Math.round(vh * 0.6), vh - 124))
  const fabRight = fabPos.left + 112
  const fabBottom = fabPos.top + 112
  const fabCenterX = fabPos.left + 56
  const topAbove = fabPos.top - drawerH - 8
  const topBelow = fabBottom + 8

  if (topAbove >= 48) {
    return {
      left: Math.round(
        fabCenterX < vw * 0.38
          ? clamp(fabPos.left, 12, Math.max(12, vw - drawerW - 12))
          : clamp(fabRight - drawerW, 12, Math.max(12, vw - drawerW - 12)),
      ),
      top: Math.round(topAbove),
    }
  }
  if (topBelow + drawerH <= vh - 12) {
    return {
      left: Math.round(
        fabCenterX < vw * 0.38
          ? clamp(fabPos.left, 12, Math.max(12, vw - drawerW - 12))
          : clamp(fabRight - drawerW, 12, Math.max(12, vw - drawerW - 12)),
      ),
      top: Math.round(topBelow),
    }
  }
  const spaceLeft = fabPos.left - 12
  const spaceRight = vw - fabRight - 12
  const left =
    spaceLeft >= drawerW + 12 || spaceLeft >= spaceRight
      ? clamp(fabPos.left - drawerW - 12, 12, Math.max(12, vw - drawerW - 12))
      : clamp(fabRight + 12, 12, Math.max(12, vw - drawerW - 12))
  const top = clamp(fabBottom - drawerH, 48, Math.max(48, vh - drawerH - 12))
  return { left: Math.round(left), top: Math.round(top) }
}

/** Renderiza negrito (**texto**) sem HTML cru. */
function renderInlineBold(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>
    }
    return <span key={idx}>{part}</span>
  })
}

export interface KanAssistantProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly currentView: PanelView
  readonly selectedProject: ProjectDto | null
  readonly activeProjects: readonly ProjectDto[]
  readonly boardTasks: readonly TaskDto[]
  readonly users: readonly SessionUserDto[]
  readonly actor: {
    readonly userId: string | undefined
    readonly name: string
    readonly isManager: boolean
  }
  readonly onNotice?: (message: string) => void
}

export function KanAssistant({
  open,
  onOpenChange,
  currentView,
  selectedProject,
  activeProjects,
  boardTasks,
  users,
  actor,
  onNotice,
}: KanAssistantProps) {
  const api = useApi()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<KanTab>(loadSavedTab)
  const [fabPos, setFabPos] = useState<Point>(loadFabPos)
  const [dragging, setDragging] = useState(false)
  const [drawerHeight, setDrawerHeight] = useState(0)

  const [apiPanelOpen, setApiPanelOpen] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getKanApiKey())
  const [modelDraft, setModelDraft] = useState(() => getKanModel())
  const [hasApiKey, setHasApiKey] = useState(() => Boolean(getKanApiKey()))
  const [apiStatus, setApiStatus] = useState('Chave salva só neste aplicativo.')

  const [messages, setMessages] = useState<KanChatMessage[]>(loadKanChatHistory)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [faqQuery, setFaqQuery] = useState('')
  const [focusFaqId, setFocusFaqId] = useState('')

  const roleKey: 'collaborator' | 'manager' = actor.isManager ? 'manager' : 'collaborator'
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => loadCompletedSteps(roleKey))

  const stageRef = useRef<HTMLSpanElement | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
  const chatListRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const kan3dRef = useRef<Kan3DController | null>(null)
  const wasOpenRef = useRef(open)

  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origLeft: 0,
    origTop: 0,
    suppressClick: false,
  })

  useEffect(() => {
    setCompletedSteps(loadCompletedSteps(roleKey))
  }, [roleKey])

  // Monta o motor 3D do Kan (com fallback suave em PNG quando sem WebGL).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const ctrl = mountKan3D(stage, {
      view: open ? 'open' : 'closed',
      follow: true,
      fps: 30,
      closedImgSrc: kanClosedUrl,
      openImgSrc: kanOpenUrl,
    })
    kan3dRef.current = ctrl
    return () => {
      ctrl.dispose()
      kan3dRef.current = null
    }
    // Monta apenas uma vez; mudanças de aberto/fechado animam via play('Open').
  }, [])

  // Sincroniza pose/animação do Kan 3D ao abrir/fechar o drawer.
  useEffect(() => {
    const ctrl = kan3dRef.current
    if (!ctrl) return
    if (open !== wasOpenRef.current) {
      ctrl.play('Open', { reverse: !open })
      wasOpenRef.current = open
    }
  }, [open])

  // Mede a altura real do drawer para posicioná-lo com precisão.
  useEffect(() => {
    if (!open || !drawerRef.current) return
    setDrawerHeight(drawerRef.current.offsetHeight)
  }, [open, apiPanelOpen])

  // Mantém o FAB dentro da viewport ao redimensionar a janela.
  useEffect(() => {
    function handleResize() {
      setFabPos((current) => {
        const vw = window.innerWidth || 1280
        const vh = window.innerHeight || 780
        let hasSaved: boolean
        try {
          hasSaved = Boolean(window.localStorage.getItem(STORAGE_POS))
        } catch {
          hasSaved = false
        }
        if (!hasSaved) return defaultFabPos()
        return {
          left: clamp(current.left, 8, Math.max(8, vw - 120)),
          top: clamp(current.top, 48, Math.max(48, vh - 120)),
        }
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Atalho global F1 (alterna Kan) e Escape (fecha quando aberto).
  useEffect(() => {
    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'F1') {
        ev.preventDefault()
        onOpenChange(!open)
      } else if (ev.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // Rola o chat para a última mensagem.
  useEffect(() => {
    if (open && tab === 'chat' && chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight
    }
  }, [open, tab, messages, busy])

  const screenGuide = useMemo(() => getKanScreenGuide(currentView), [currentView])

  const handleMutated = useCallback(
    (summary: string) => {
      kan3dRef.current?.play('Spin_360')
      void queryClient.invalidateQueries()
      onNotice?.(summary)
    },
    [queryClient, onNotice],
  )

  const runtimeContext = useMemo<KanRuntimeContext>(
    () => ({
      api,
      actor,
      currentScreenTitle: screenGuide.title,
      selectedProject,
      activeProjects,
      boardTasks,
      users,
      onMutated: handleMutated,
    }),
    [
      api,
      actor,
      screenGuide.title,
      selectedProject,
      activeProjects,
      boardTasks,
      users,
      handleMutated,
    ],
  )

  function selectTab(next: KanTab, faqId?: string) {
    setTab(next)
    setFocusFaqId(faqId ?? '')
    try {
      window.localStorage.setItem(STORAGE_TAB, next)
    } catch {
      /* ignore */
    }
  }

  function handleFabPointerDown(ev: React.PointerEvent<HTMLButtonElement>) {
    if (ev.button !== 0) return
    dragRef.current = {
      active: true,
      moved: false,
      startX: ev.clientX,
      startY: ev.clientY,
      origLeft: fabPos.left,
      origTop: fabPos.top,
      suppressClick: false,
    }
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId)
    } catch {
      /* ignore */
    }
  }

  function handleFabPointerMove(ev: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag.active) return
    const dx = ev.clientX - drag.startX
    const dy = ev.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true
      setDragging(true)
    }
    if (!drag.moved) return
    const vw = window.innerWidth || 1280
    const vh = window.innerHeight || 780
    setFabPos({
      left: Math.round(clamp(drag.origLeft + dx, 8, Math.max(8, vw - 120))),
      top: Math.round(clamp(drag.origTop + dy, 48, Math.max(48, vh - 120))),
    })
  }

  function handleFabPointerUp(ev: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag.active) return
    drag.active = false
    setDragging(false)
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId)
    } catch {
      /* ignore */
    }
    if (drag.moved) {
      drag.suppressClick = true
      try {
        window.localStorage.setItem(STORAGE_POS, JSON.stringify(fabPos))
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        dragRef.current.suppressClick = false
      }, 40)
    }
  }

  function handleFabClick() {
    if (dragRef.current.suppressClick) return
    onOpenChange(!open)
  }

  function handleSaveApiKey() {
    const clean = apiKeyDraft.trim()
    setKanApiKey(clean)
    setKanModel(modelDraft)
    setHasApiKey(Boolean(clean))
    setApiStatus(
      clean ? 'Chave salva com segurança neste aplicativo.' : 'Chave removida. Usando modo local.',
    )
    onNotice?.(clean ? 'Chave Google AI Studio conectada.' : 'Modo local do Kan ativado.')
    if (clean) setApiPanelOpen(false)
  }

  function handleClearApiKey() {
    setApiKeyDraft('')
    setKanApiKey('')
    setHasApiKey(false)
    setApiStatus('Chave removida. Modo local ativo.')
  }

  async function handleTestApiKey() {
    const candidate = apiKeyDraft.trim() || getKanApiKey()
    setKanModel(modelDraft)
    setApiStatus('Testando conexão com Google AI Studio...')
    const res = await testKanApiKey(candidate, modelDraft)
    setApiStatus(res.message)
    if (res.ok && candidate) {
      setKanApiKey(candidate)
      setHasApiKey(true)
    }
  }

  async function submitPrompt(rawText: string) {
    const text = rawText.trim()
    if (!text || busy) return
    const userMsg: KanChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      actions: [],
      confirmations: [],
    }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    saveKanChatHistory(nextHistory)
    setDraft('')
    setBusy(true)

    const result = await sendKanMessage(runtimeContext, messages, text)

    const assistantMsg: KanChatMessage = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      text: result.text || 'Concluído.',
      actions: result.actions,
      confirmations: result.confirmations,
    }
    const finalHistory = [...nextHistory, assistantMsg]
    setMessages(finalHistory)
    saveKanChatHistory(finalHistory)
    setBusy(false)
    chatInputRef.current?.focus()
  }

  function handleFormSubmit(ev: FormEvent) {
    ev.preventDefault()
    void submitPrompt(draft)
  }

  async function handleUndo(msgIdx: number, actIdx: number, undoId: string) {
    const res = await undoKanAction(undoId, handleMutated)
    if (!res.ok) {
      onNotice?.(res.message)
      return
    }
    setMessages((prev) => {
      const next = prev.map((m, i) =>
        i === msgIdx
          ? {
              ...m,
              actions: m.actions.map((a, j) => (j === actIdx ? { ...a, undone: true } : a)),
            }
          : m,
      )
      saveKanChatHistory(next)
      return next
    })
  }

  async function handleConfirm(msgIdx: number, confIdx: number, conf: KanConfirmationRequest) {
    const executed = await confirmKanPendingAction(runtimeContext, conf)
    setMessages((prev) => {
      const next = prev.map((m, i) => {
        if (i !== msgIdx) return m
        return {
          ...m,
          text: executed.ok ? m.text : `${m.text}\n${executed.error ?? 'Falha ao confirmar.'}`,
          actions: executed.receipt ? [...m.actions, executed.receipt] : m.actions,
          confirmations: m.confirmations.map((c, j) =>
            j === confIdx ? { ...c, resolved: true } : c,
          ),
        }
      })
      saveKanChatHistory(next)
      return next
    })
  }

  function handleCancelConfirmation(msgIdx: number, confIdx: number) {
    setMessages((prev) => {
      const next = prev.map((m, i) =>
        i === msgIdx
          ? {
              ...m,
              text: `${m.text}\n(Ação crítica cancelada.)`,
              confirmations: m.confirmations.map((c, j) =>
                j === confIdx ? { ...c, resolved: true } : c,
              ),
            }
          : m,
      )
      saveKanChatHistory(next)
      return next
    })
  }

  function toggleStep(stepId: string) {
    setCompletedSteps((prev) => {
      const exists = prev.includes(stepId)
      const next = exists ? prev.filter((id) => id !== stepId) : [...prev, stepId]
      saveCompletedSteps(roleKey, next)
      if (!exists) onNotice?.('Passo concluído na trilha do Kan!')
      return next
    })
  }

  const drawerPos = computeDrawerPos(fabPos, drawerHeight)
  const firstTaskKey = boardTasks[0]?.key ?? 'AB-1'
  const firstUserName = users[0]?.name.split(' ')[0] ?? 'Pedro'

  const checklist = KAN_CHECKLISTS[roleKey]
  const checklistPct = Math.round((completedSteps.length / checklist.length) * 100)

  const filteredFaq = useMemo(() => {
    const q = faqQuery.trim().toLowerCase()
    if (!q) return KAN_FAQ_ITEMS
    return KAN_FAQ_ITEMS.filter(
      (item) =>
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    )
  }, [faqQuery])

  return (
    <>
      <button
        type="button"
        className={`${styles.fab} ${dragging ? styles.dragging : ''}`}
        style={{ left: `${fabPos.left}px`, top: `${fabPos.top}px` }}
        aria-label="Kan · Abrir chat assistente (F1) · Arraste para mover"
        aria-expanded={open}
        title="Clique para conversar com o Kan (F1) ou arraste para mover"
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        onPointerCancel={handleFabPointerUp}
        onClick={handleFabClick}
      >
        <span ref={stageRef} className={styles.fabStage}>
          <img
            data-kan-fallback=""
            className={styles.fabFallback}
            src={open ? kanOpenUrl : kanClosedUrl}
            alt="Kan"
          />
        </span>
      </button>

      <aside
        ref={drawerRef}
        className={`${styles.drawer} ${open ? styles.open : ''}`}
        style={{ left: `${drawerPos.left}px`, top: `${drawerPos.top}px` }}
        aria-label="Kan · Chat e Guia do AgileBox"
        aria-hidden={!open}
      >
        <div className={styles.header}>
          <span
            className={`${styles.headerDot} ${hasApiKey ? '' : styles.local}`}
            aria-hidden="true"
          />
          <div className={styles.titleGroup}>
            <h3 className={styles.title}>Kan · Assistente</h3>
            <p className={styles.subtitle}>
              {hasApiKey ? `Gemini · ${modelDraft}` : `Modo local · ${screenGuide.title}`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.iconBtn} ${apiPanelOpen ? styles.active : ''} ${hasApiKey ? styles.connected : ''}`}
              aria-expanded={apiPanelOpen}
              title="Conectar API gratuita do Google AI Studio (Gemini)"
              onClick={() => {
                setApiPanelOpen((prev) => !prev)
                setApiKeyDraft(getKanApiKey())
                setModelDraft(getKanModel())
              }}
            >
              {hasApiKey ? 'Gemini ON' : 'Chave AI'}
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="Fechar Kan"
              title="Fechar (F1)"
              onClick={() => onOpenChange(false)}
            >
              ×
            </button>
          </div>
        </div>

        {apiPanelOpen ? (
          <div className={styles.apiPanel}>
            <div className={styles.apiRow}>
              <input
                type="password"
                className={styles.input}
                value={apiKeyDraft}
                onChange={(ev) => setApiKeyDraft(ev.target.value)}
                placeholder="Cole sua chave do Google AI Studio (AIza...)"
                aria-label="Chave da API Google AI Studio"
              />
              <button
                type="button"
                className={`${styles.smallBtn} ${styles.smallBtnPrimary}`}
                onClick={handleSaveApiKey}
              >
                Salvar
              </button>
            </div>
            <div className={styles.apiRow}>
              <select
                className={styles.select}
                aria-label="Modelo Gemini"
                value={modelDraft}
                onChange={(ev) => setModelDraft(ev.target.value)}
              >
                {KAN_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.smallBtn}
                onClick={() => void handleTestApiKey()}
              >
                Testar
              </button>
              <button
                type="button"
                className={`${styles.smallBtn} ${styles.smallBtnGhost}`}
                onClick={handleClearApiKey}
              >
                Limpar
              </button>
            </div>
            <div className={styles.apiMeta}>
              <span>{apiStatus}</span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Obter chave ↗
              </a>
            </div>
          </div>
        ) : null}

        <div className={styles.tabs} role="tablist" aria-label="Abas do Kan">
          {(
            [
              ['chat', 'Chat IA'],
              ['screen', 'Esta tela'],
              ['steps', 'Passos'],
              ['faq', 'Dúvidas'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`${styles.tab} ${tab === id ? styles.active : ''}`}
              onClick={() => selectTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={`${styles.body} ${tab === 'chat' ? styles.bodyChat : ''}`}>
          {tab === 'chat' ? (
            <div className={styles.chatShell}>
              <div ref={chatListRef} className={styles.chatList}>
                {messages.map((msg, msgIdx) => (
                  <div
                    key={msg.id}
                    className={`${styles.msg} ${msg.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
                  >
                    <div className={styles.msgBubble}>{renderInlineBold(msg.text)}</div>
                    {msg.actions.map((act, actIdx) => {
                      const undone = Boolean(act.undone || isKanActionUndone(act.undoId))
                      return (
                        <div
                          key={act.undoId}
                          className={`${styles.actionReceipt} ${undone ? styles.undone : ''}`}
                        >
                          <div className={styles.actionInfo}>
                            <div className={styles.actionTitle}>{act.summary}</div>
                            {act.detail ? (
                              <div className={styles.actionDetail}>{act.detail}</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className={styles.undoBtn}
                            disabled={undone}
                            onClick={() => void handleUndo(msgIdx, actIdx, act.undoId)}
                          >
                            {undone ? 'Desfeito' : 'Desfazer'}
                          </button>
                        </div>
                      )
                    })}
                    {msg.confirmations
                      .filter((conf) => !conf.resolved)
                      .map((conf, confIdx) => (
                        <div key={conf.id} className={styles.confirmCard}>
                          <div className={styles.actionTitle}>{conf.actionTitle}</div>
                          <div className={styles.confirmDesc}>{conf.detail}</div>
                          <div className={styles.confirmBtns}>
                            <button
                              type="button"
                              className={`${styles.smallBtn} ${styles.smallBtnGhost}`}
                              onClick={() => handleCancelConfirmation(msgIdx, confIdx)}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className={`${styles.smallBtn} ${styles.smallBtnPrimary}`}
                              onClick={() => void handleConfirm(msgIdx, confIdx, conf)}
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
                {busy ? (
                  <div className={`${styles.msg} ${styles.msgAssistant}`}>
                    <div className={`${styles.msgBubble} ${styles.msgThinking}`}>
                      Kan pensando e executando...
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={styles.suggestions}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    void submitPrompt(
                      `Criar tarefa Validar webhook de pagamento em A fazer para ${firstUserName}`,
                    )
                  }
                >
                  + Nova tarefa
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => void submitPrompt(`Mover ${firstTaskKey} para Revisar`)}
                >
                  {firstTaskKey} → Revisar
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => void submitPrompt(`Lançar 1h em ${firstTaskKey}`)}
                >
                  +1h em {firstTaskKey}
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    void submitPrompt('Registrar daily: avancei no quadro, sem bloqueios')
                  }
                >
                  Daily
                </button>
              </div>

              <form className={styles.composer} onSubmit={handleFormSubmit}>
                <input
                  ref={chatInputRef}
                  type="text"
                  className={styles.input}
                  value={draft}
                  onChange={(ev) => setDraft(ev.target.value)}
                  placeholder="Peça ao Kan ou tire uma dúvida..."
                  aria-label="Mensagem para o Kan"
                  autoComplete="off"
                />
                <button type="submit" className={styles.sendBtn} disabled={busy}>
                  Enviar
                </button>
              </form>
            </div>
          ) : null}

          {tab === 'screen' ? (
            <>
              <div className={styles.card}>
                <h4>Você está em: {screenGuide.title}</h4>
                <p>{screenGuide.summary}</p>
              </div>
              <div className={styles.card}>
                <h4>Como funciona aqui</h4>
                <ol className={styles.list}>
                  {screenGuide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className={styles.card}>
                <h4>Dúvidas rápidas desta tela</h4>
                <div className={styles.quickLinks}>
                  {screenGuide.actions.map((action) => (
                    <button
                      key={action.faqKey}
                      type="button"
                      className={styles.actionLink}
                      onClick={() => selectTab('faq', action.faqKey)}
                    >
                      <span>{action.label}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {tab === 'steps' ? (
            <>
              <div className={styles.card}>
                <h4>Trilha para {actor.isManager ? 'Gestor' : 'Colaborador'}</h4>
                <p className={styles.progressText}>
                  {completedSteps.length} de {checklist.length} passos concluídos ({checklistPct}%).
                </p>
                <div className={styles.progress}>
                  <div className={styles.progressFill} style={{ width: `${checklistPct}%` }} />
                </div>
              </div>
              {checklist.map((step) => {
                const isDone = completedSteps.includes(step.id)
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`${styles.step} ${isDone ? styles.done : ''}`}
                    onClick={() => toggleStep(step.id)}
                  >
                    <span className={styles.stepCheck} aria-hidden="true">
                      {isDone ? '✓' : ''}
                    </span>
                    <span>
                      <div className={styles.stepTitle}>{step.title}</div>
                      <div className={styles.stepDesc}>{step.desc}</div>
                    </span>
                  </button>
                )
              })}
            </>
          ) : null}

          {tab === 'faq' ? (
            <>
              <input
                type="search"
                className={styles.input}
                value={faqQuery}
                onChange={(ev) => {
                  setFocusFaqId('')
                  setFaqQuery(ev.target.value)
                }}
                placeholder="Buscar dúvida ou termo (ex.: WIP, R$, Sprint...)"
                aria-label="Buscar no dicionário e dúvidas"
              />
              <div className={styles.faqList}>
                {filteredFaq.length === 0 ? (
                  <div className={styles.card}>
                    <p>
                      Nenhum termo encontrado para &ldquo;{faqQuery}&rdquo;. Tente buscar por WIP,
                      R$, Sprint, Entidades ou Bandeja.
                    </p>
                  </div>
                ) : (
                  filteredFaq.map((item) => {
                    const shouldOpen =
                      (Boolean(focusFaqId) && item.id === focusFaqId) ||
                      (Boolean(faqQuery.trim()) && filteredFaq.length <= 3)
                    return (
                      <details key={item.id} className={styles.faqItem} open={shouldOpen}>
                        <summary>
                          <span>{item.q}</span>
                        </summary>
                        <div className={styles.faqAnswer}>{item.a}</div>
                      </details>
                    )
                  })
                )}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </>
  )
}
