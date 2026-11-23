import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AiChatTurn, AiContextSnapshot, TaskDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { isDefinitionOfDoneNotConfirmed } from '../../shared/definition-of-done/definition-of-done'
import { useDefinitionOfDoneGate } from '../../shared/definition-of-done/use-definition-of-done-gate'
import { todayDateOnly } from '../../shared/lib/today'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { useProjects } from '../../panel/hooks/use-projects'
import { useSessionUsers } from '../../panel/hooks/use-session-users'
import { trayCopy } from '../copy'
import {
  describeKanError,
  executeKanActions,
  type KanActionReceipt,
  type PromptDefinitionOfDone,
} from '../kan/kan-executor'
import { parseLocalKanPrompt } from '../kan/kan-local-parser'
import styles from './KanChatScreen.module.css'

interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly receipts: readonly KanActionReceipt[]
}

let msgSeq = 0
function nextMessageId(): string {
  msgSeq += 1
  return `kan-msg-${msgSeq}`
}

function initialGreeting(): string {
  return 'Oi! Posso listar suas tarefas em foco, criar novas tarefas, mudar estados, comentar ou lançar horas.'
}

export function KanChatScreen() {
  const api = useApi()
  const queryClient = useQueryClient()
  const actor = useActor()
  const projects = useProjects()
  const users = useSessionUsers()
  const capabilities = useCapabilities()
  const definitionGate = useDefinitionOfDoneGate()

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<readonly ChatMessage[]>(() => [
    { id: nextMessageId(), role: 'assistant', text: initialGreeting(), receipts: [] },
  ])

  const board = useQuery({
    queryKey: queryKeys.tasks.board(undefined, actor.actor?.userId),
    enabled: Boolean(actor.actor),
    queryFn: () =>
      api.tasks.listBoard(actor.actor?.role === 'manager' ? { forUserId: actor.actor.userId } : {}),
  })
  const recent = useQuery({
    queryKey: [...queryKeys.tasks.all, 'tray', 'recent'],
    queryFn: () => api.tasks.listRecent(),
  })

  const tasks = useMemo<TaskDto[]>(() => {
    const merged = new Map<string, TaskDto>()
    for (const task of recent.data ?? []) merged.set(task.id, task)
    for (const task of board.data?.tasks ?? []) merged.set(task.id, task)
    return Array.from(merged.values())
  }, [board.data?.tasks, recent.data])

  const contextSnapshot = useMemo<AiContextSnapshot>(() => {
    const currentUser = users.data?.find((u) => u.id === actor.actor?.userId)
    return {
      actorName: currentUser?.name ?? 'Colaborador',
      actorRole: actor.actor?.role ?? 'collaborator',
      projects: (projects.data ?? [])
        .filter((p) => !p.archivedAt)
        .map((p) => ({ id: p.id, name: p.name })),
      users: (users.data ?? []).map((u) => ({ id: u.id, name: u.name })),
      tasks: tasks.map((t) => ({
        id: t.id,
        key: t.key,
        title: t.title,
        status: t.status,
        projectName: t.projectName,
        blocked: Boolean(t.blockedAt || t.blockedReason || t.impediment),
      })),
      capabilities: {
        checkins: capabilities.can('checkins:screen'),
        impediments: capabilities.showScreen('impediments'),
      },
    }
  }, [actor.actor?.role, actor.actor?.userId, capabilities, projects.data, tasks, users.data])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, busy])

  const invalidateWorkspace = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.daily.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.impediments.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline.all }),
    ])
  }, [queryClient])

  const promptDoD = useCallback<PromptDefinitionOfDone>(
    (request, onConfirm) =>
      new Promise((resolve) => {
        let settled = false
        const finish = (outcome: {
          confirmed: boolean
          receipt?: KanActionReceipt
          error?: string
        }) => {
          if (settled) return
          settled = true
          resolve(outcome)
        }
        void definitionGate.conclude({
          ...request,
          complete: async (confirmedIds) => {
            try {
              const receipt = await onConfirm(confirmedIds)
              finish({ confirmed: true, receipt })
            } catch (error) {
              if (isDefinitionOfDoneNotConfirmed(error)) throw error
              finish({ confirmed: true, error: describeKanError(error) })
            }
          },
          onCancel: () => finish({ confirmed: false }),
        })
      }),
    [definitionGate],
  )

  const submitPrompt = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || busy) return
      setDraft('')
      setBusy(true)

      const userMessage: ChatMessage = {
        id: nextMessageId(),
        role: 'user',
        text,
        receipts: [],
      }
      const historyTurns: AiChatTurn[] = messages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text,
      }))
      setMessages((prev) => [...prev, userMessage])

      try {
        const today = todayDateOnly()
        const aiBridge = window.agilebox?.ai
        let replyText = ''
        let actionsToRun = [] as ReturnType<typeof parseLocalKanPrompt>['actions']

        let handledByGemini = false
        if (aiBridge) {
          try {
            const config = await aiBridge.getConfig()
            if (config.configured) {
              const remote = await aiBridge.complete({
                prompt: text,
                history: historyTurns,
                context: contextSnapshot,
              })
              if (remote.ok) {
                replyText = remote.reply
                actionsToRun = remote.actions
                handledByGemini = true
              } else if (remote.reason !== 'not_configured') {
                const local = parseLocalKanPrompt(text, contextSnapshot, today)
                replyText =
                  local.actions.length > 0
                    ? `${remote.message} Executando localmente.`
                    : `${remote.message} ${local.reply}`
                actionsToRun = local.actions
                handledByGemini = true
              }
            }
          } catch {
            handledByGemini = false
          }
        }

        if (!handledByGemini) {
          const local = parseLocalKanPrompt(text, contextSnapshot, today)
          replyText = local.reply
          actionsToRun = local.actions
        }

        let receipts: KanActionReceipt[] = []
        let errors: string[] = []
        if (actionsToRun.length > 0) {
          const outcome = await executeKanActions({
            api,
            actorUserId: actor.actor?.userId ?? contextSnapshot.users[0]?.id ?? '',
            today,
            context: contextSnapshot,
            actions: actionsToRun,
            promptDoD,
          })
          receipts = outcome.receipts
          errors = outcome.errors
          if (receipts.length > 0) {
            await invalidateWorkspace()
          }
        }

        const combinedText = [replyText, ...errors].filter(Boolean).join('\n')
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: 'assistant',
            text: combinedText || 'Pronto.',
            receipts,
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [actor.actor?.userId, api, busy, contextSnapshot, invalidateWorkspace, messages, promptDoD],
  )

  const handleUndo = useCallback(
    async (messageId: string, receiptId: string, undo: () => Promise<void>) => {
      try {
        await undo()
        setMessages((prev) =>
          prev.map((message) =>
            message.id !== messageId
              ? message
              : {
                  ...message,
                  receipts: message.receipts.map((receipt) =>
                    receipt.id === receiptId ? { ...receipt, undone: true } : receipt,
                  ),
                },
          ),
        )
        await invalidateWorkspace()
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: 'assistant',
            text: describeKanError(error),
            receipts: [],
          },
        ])
      }
    },
    [invalidateWorkspace],
  )

  const firstOpenTask = tasks.find((t) => t.status !== 'done') ?? tasks[0]
  const checkinsEnabled = capabilities.can('checkins:screen')

  return (
    <div className={styles.shell}>
      <div
        ref={listRef}
        className={styles.messages}
        role="log"
        aria-live="polite"
        aria-label="Conversa com o Kan"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.msg} ${message.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
          >
            <div className={styles.bubble}>{message.text}</div>
            {message.receipts.map((receipt) => (
              <div
                key={receipt.id}
                className={`${styles.receipt} ${receipt.undone ? styles.receiptUndone : ''}`}
              >
                <div className={styles.receiptInfo}>
                  <span className={styles.receiptTitle}>{receipt.summary}</span>
                  {receipt.detail ? (
                    <span className={styles.receiptDetail}>{receipt.detail}</span>
                  ) : null}
                </div>
                {receipt.undo ? (
                  <button
                    type="button"
                    className={styles.undoBtn}
                    disabled={receipt.undone}
                    onClick={() => void handleUndo(message.id, receipt.id, receipt.undo!)}
                  >
                    {receipt.undone ? trayCopy.kanUndone : trayCopy.kanUndo}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ))}
        {busy ? (
          <div className={`${styles.msg} ${styles.msgAssistant}`}>
            <div className={`${styles.bubble} ${styles.thinking}`}>{trayCopy.kanThinking}</div>
          </div>
        ) : null}
      </div>

      <div className={styles.suggestions} role="group" aria-label="Sugestões rápidas">
        <button
          type="button"
          className={styles.chip}
          disabled={busy}
          onClick={() => void submitPrompt('Quais são minhas tarefas em foco?')}
        >
          Em foco
        </button>
        <button
          type="button"
          className={styles.chip}
          disabled={busy}
          onClick={() => {
            setDraft('Criar tarefa ')
            inputRef.current?.focus()
          }}
        >
          + Nova tarefa
        </button>
        {firstOpenTask ? (
          <>
            <button
              type="button"
              className={styles.chip}
              disabled={busy}
              onClick={() => void submitPrompt(`Mover ${firstOpenTask.key} para Revisar`)}
            >
              {firstOpenTask.key} → Revisar
            </button>
            <button
              type="button"
              className={styles.chip}
              disabled={busy}
              onClick={() => void submitPrompt(`Lançar 1h em ${firstOpenTask.key}`)}
            >
              +1h em {firstOpenTask.key}
            </button>
          </>
        ) : null}
        {checkinsEnabled ? (
          <button
            type="button"
            className={styles.chip}
            disabled={busy}
            onClick={() => {
              setDraft('Registrar daily: ')
              inputRef.current?.focus()
            }}
          >
            Daily
          </button>
        ) : null}
      </div>

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault()
          void submitPrompt(draft)
        }}
      >
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          aria-label="Mensagem para o Kan"
          placeholder={trayCopy.kanPlaceholder}
          value={draft}
          disabled={busy}
          autoComplete="off"
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <button type="submit" className={styles.sendBtn} disabled={busy || !draft.trim()}>
          {trayCopy.kanSend}
        </button>
      </form>
      {definitionGate.dialog}
    </div>
  )
}
