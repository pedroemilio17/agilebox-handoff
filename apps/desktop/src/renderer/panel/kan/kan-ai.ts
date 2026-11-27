import { TASK_STATUS_LABELS, type TaskStatus } from '@agilebox/core'
import {
  ApiError,
  type AgileBoxApi,
  type ProjectDto,
  type SessionUserDto,
  type TaskDto,
} from '@agilebox/contract'
import { todayDateOnly } from '../../shared/lib/today'

const KEY_API = 'agilebox_kan_gemini_key'
const KEY_MODEL = 'agilebox_kan_gemini_model'
const KEY_CHAT = 'agilebox_kan_chat_v1'

export const DEFAULT_KAN_MODEL = 'gemini-2.5-flash'
export const KAN_MODELS = [
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Recomendado · Grátis)' },
  { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { id: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (Mais rápido)' },
] as const

export interface KanActionReceipt {
  readonly undoId: string
  readonly summary: string
  readonly detail: string
  readonly undone?: boolean
}

export interface KanConfirmationRequest {
  readonly id: string
  readonly toolName: 'manage_sprint'
  readonly actionTitle: string
  readonly detail: string
  readonly pendingArgs: Readonly<Record<string, unknown>>
  readonly resolved?: boolean
}

export interface KanChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly actions: readonly KanActionReceipt[]
  readonly confirmations: readonly KanConfirmationRequest[]
}

export interface KanRuntimeContext {
  readonly api: AgileBoxApi
  readonly actor: {
    readonly userId: string | undefined
    readonly name: string
    readonly isManager: boolean
  }
  readonly currentScreenTitle: string
  readonly selectedProject: ProjectDto | null
  readonly activeProjects: readonly ProjectDto[]
  readonly boardTasks: readonly TaskDto[]
  readonly users: readonly SessionUserDto[]
  readonly onMutated: (summary: string) => void
}

export interface KanSendResult {
  readonly mode: 'local' | 'gemini' | 'error'
  readonly text: string
  readonly actions: readonly KanActionReceipt[]
  readonly confirmations: readonly KanConfirmationRequest[]
  readonly error?: string
}

interface UndoEntry {
  readonly label: string
  undone: boolean
  readonly revert: () => Promise<void>
}

interface ToolResult {
  readonly ok: boolean
  readonly error?: string
  readonly summary?: string
  readonly detail?: string
  readonly undoId?: string
  readonly needsConfirmation?: boolean
  readonly confirmation?: KanConfirmationRequest
  readonly data?: unknown
}

const undoRegistry = new Map<string, UndoEntry>()

function registerUndo(label: string, revert: () => Promise<void>): string {
  const id = `undo_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  undoRegistry.set(id, { label, undone: false, revert })
  return id
}

export function isKanActionUndone(undoId: string): boolean {
  return undoRegistry.get(undoId)?.undone === true
}

export async function undoKanAction(
  undoId: string,
  onMutated?: (summary: string) => void,
): Promise<{ readonly ok: boolean; readonly message: string }> {
  const entry = undoRegistry.get(undoId)
  if (!entry) {
    return {
      ok: false,
      message: 'Ação anterior expirou nesta sessão (não é mais possível desfazer).',
    }
  }
  if (entry.undone) {
    return { ok: false, message: 'Esta ação já foi desfeita.' }
  }
  try {
    await entry.revert()
    entry.undone = true
    onMutated?.(`Desfeito: ${entry.label}`)
    return { ok: true, message: `Desfeito: ${entry.label}` }
  } catch (err) {
    return { ok: false, message: formatError(err, 'Não foi possível desfazer a ação.') }
  }
}

export function getKanApiKey(): string {
  try {
    return window.localStorage.getItem(KEY_API) ?? ''
  } catch {
    return ''
  }
}

export function setKanApiKey(key: string): void {
  try {
    const clean = key.trim()
    if (clean) window.localStorage.setItem(KEY_API, clean)
    else window.localStorage.removeItem(KEY_API)
  } catch {
    /* ignore */
  }
}

export function getKanModel(): string {
  try {
    return window.localStorage.getItem(KEY_MODEL) ?? DEFAULT_KAN_MODEL
  } catch {
    return DEFAULT_KAN_MODEL
  }
}

export function setKanModel(model: string): void {
  try {
    window.localStorage.setItem(KEY_MODEL, model || DEFAULT_KAN_MODEL)
  } catch {
    /* ignore */
  }
}

export function loadKanChatHistory(): KanChatMessage[] {
  try {
    const raw = window.localStorage.getItem(KEY_CHAT)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as KanChatMessage[]
      }
    }
  } catch {
    /* ignore */
  }
  return [
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Oi! Sou o Kan. Posso responder dúvidas desta tela ou agir no seu projeto real: criar tarefas, mover estados, lançar horas, registrar bloqueios, atualizar Sprint/Backlog e salvar sua Daily — sempre com **Desfazer**.',
      actions: [],
      confirmations: [],
    },
  ]
}

export function saveKanChatHistory(messages: readonly KanChatMessage[]): void {
  try {
    window.localStorage.setItem(KEY_CHAT, JSON.stringify(messages.slice(-30)))
  } catch {
    /* ignore */
  }
}

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function parseTaskStatusInput(raw: string | undefined): TaskStatus | null {
  if (!raw) return null
  const n = normalizeText(raw)
  if (!n) return null
  if (n.includes('planej') || n === 'planning' || n === 'plan') return 'planning'
  if (n.includes('fazer') || n === 'todo' || n === 'to do' || n === 'afazer') return 'todo'
  if (
    n.includes('desenv') ||
    n.includes('andament') ||
    n === 'in_progress' ||
    n === 'in progress' ||
    n === 'doing'
  ) {
    return 'in_progress'
  }
  if (n.includes('revis') || n === 'review' || n === 'qa') return 'review'
  if (
    n.includes('conclu') ||
    n === 'done' ||
    n === 'feito' ||
    n === 'pronto' ||
    n === 'finalizado'
  ) {
    return 'done'
  }
  return null
}

function parsePriorityInput(raw: string | undefined): 'normal' | 'high' | null {
  if (!raw) return null
  const n = normalizeText(raw)
  if (n.includes('alt') || n === 'high' || n === 'urgente') return 'high'
  if (n.includes('norm') || n.includes('med') || n.includes('baix') || n === 'low') return 'normal'
  return null
}

function findUserByName(
  users: readonly SessionUserDto[],
  rawName: string | undefined,
): SessionUserDto | undefined {
  if (!rawName) return undefined
  const target = normalizeText(rawName)
  if (!target) return undefined
  return (
    users.find((u) => normalizeText(u.name) === target) ??
    users.find((u) => normalizeText(u.name).startsWith(target)) ??
    users.find((u) => normalizeText(u.initials) === target) ??
    users.find((u) => normalizeText(u.name).includes(target))
  )
}

function findTaskInList(tasks: readonly TaskDto[], ref: string | undefined): TaskDto | undefined {
  if (!ref) return undefined
  const clean = ref.trim()
  if (!clean) return undefined
  const upper = clean.toUpperCase()
  const norm = normalizeText(clean)
  return (
    tasks.find((t) => t.key.toUpperCase() === upper) ??
    tasks.find((t) => t.id === clean) ??
    tasks.find((t) => normalizeText(t.title).includes(norm))
  )
}

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function formatHoursString(hours: number): string {
  return String(Math.round(hours * 100) / 100).replace('.', ',')
}

function pickTargetProject(ctx: KanRuntimeContext, projectHint?: string): ProjectDto | undefined {
  if (projectHint) {
    const norm = normalizeText(projectHint)
    const found = ctx.activeProjects.find(
      (p) => p.id === projectHint || normalizeText(p.name).includes(norm),
    )
    if (found) return found
  }
  return ctx.selectedProject ?? ctx.activeProjects[0]
}

async function fetchWorkspaceSnapshot(ctx: KanRuntimeContext) {
  const board = await ctx.api.tasks.listBoard({
    ...(ctx.selectedProject ? { projectId: ctx.selectedProject.id } : {}),
  })
  return {
    activeRole: ctx.actor.isManager ? 'manager' : 'collaborator',
    actorName: ctx.actor.name,
    currentScreen: ctx.currentScreenTitle,
    activeProjectId: ctx.selectedProject?.id ?? null,
    activeProjectName: ctx.selectedProject?.name ?? 'Todos os projetos',
    projects: ctx.activeProjects.map((p) => ({ id: p.id, name: p.name })),
    users: ctx.users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    tasks: board.tasks.slice(0, 40).map((t) => ({
      id: t.id,
      key: t.key,
      title: t.title,
      projectName: t.projectName,
      status: TASK_STATUS_LABELS[t.status],
      priority: t.priority === 'high' ? 'Alta' : 'Normal',
      blocked: t.blockedReason !== null,
      blockedReason: t.blockedReason,
      deadline: t.deadline,
      actualHours: t.actualHours ?? 0,
    })),
  }
}

async function toolCreateTask(
  ctx: KanRuntimeContext,
  args: Readonly<Record<string, unknown>>,
): Promise<ToolResult> {
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  if (!title) return { ok: false, error: 'Informe um título para a nova tarefa.' }

  const projectHint = typeof args.project === 'string' ? args.project : undefined
  const project = pickTargetProject(ctx, projectHint)
  if (!project) {
    return { ok: false, error: 'Nenhum projeto ativo disponível para criar a tarefa.' }
  }

  const status = parseTaskStatusInput(typeof args.status === 'string' ? args.status : undefined)
  const assigneeUser = findUserByName(
    ctx.users,
    typeof args.assignee === 'string' ? args.assignee : undefined,
  )
  const priority = parsePriorityInput(typeof args.priority === 'string' ? args.priority : undefined)
  const description = typeof args.description === 'string' ? args.description.trim() : ''
  const subtasks = Array.isArray(args.subtasks)
    ? args.subtasks.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : []

  try {
    const created = await ctx.api.tasks.create({
      projectId: project.id,
      title,
      ...(status ? { status } : {}),
      ...(assigneeUser ? { responsibleId: assigneeUser.id } : {}),
    })

    if (priority === 'high' || description) {
      await ctx.api.tasks.update({
        taskId: created.id,
        changes: {
          ...(priority === 'high' ? { priority: 'high' } : {}),
          ...(description ? { description } : {}),
        },
      })
    }

    for (const sub of subtasks.slice(0, 10)) {
      await ctx.api.tasks.checklist.add({ taskId: created.id, title: sub.trim() })
    }

    if (args.addToSprint === true) {
      try {
        const sprints = await ctx.api.sprints.list({ projectId: project.id, status: 'active' })
        const activeSprint = sprints[0]
        if (activeSprint) {
          await ctx.api.sprints.addTask({ sprintId: activeSprint.id, taskId: created.id })
        }
      } catch {
        /* módulo de sprints pode estar desligado no projeto */
      }
    }

    const summary = `Tarefa ${created.key} criada`
    const detail = `${created.title} · ${TASK_STATUS_LABELS[created.status]} (${project.name})`
    const undoId = registerUndo(summary, async () => {
      await ctx.api.tasks.archive({ taskId: created.id })
    })
    ctx.onMutated(summary)
    return { ok: true, summary, detail, undoId, data: { key: created.key, id: created.id } }
  } catch (err) {
    return { ok: false, error: formatError(err, 'Não foi possível criar a tarefa.') }
  }
}

async function toolUpdateTask(
  ctx: KanRuntimeContext,
  args: Readonly<Record<string, unknown>>,
): Promise<ToolResult> {
  const ref = typeof args.taskId === 'string' ? args.taskId : ''
  const board = await ctx.api.tasks.listBoard({
    ...(ctx.selectedProject ? { projectId: ctx.selectedProject.id } : {}),
  })
  const task = findTaskInList(board.tasks, ref) ?? findTaskInList(ctx.boardTasks, ref)
  if (!task) {
    return {
      ok: false,
      error: ref
        ? `Não encontrei a tarefa "${ref}" entre as tarefas visíveis.`
        : 'Informe o código (ex.: AB-1) ou parte do título da tarefa.',
    }
  }

  const undoSteps: Array<() => Promise<void>> = []
  const changesSummary: string[] = []

  try {
    const nextStatus = parseTaskStatusInput(
      typeof args.status === 'string' ? args.status : undefined,
    )
    if (nextStatus && nextStatus !== task.status) {
      const prevStatus = task.status
      await ctx.api.tasks.move({ taskId: task.id, status: nextStatus })
      undoSteps.push(async () => {
        await ctx.api.tasks.move({ taskId: task.id, status: prevStatus })
      })
      changesSummary.push(`estado → ${TASK_STATUS_LABELS[nextStatus]}`)
    }

    const nextTitle = typeof args.title === 'string' ? args.title.trim() : ''
    const nextPriority = parsePriorityInput(
      typeof args.priority === 'string' ? args.priority : undefined,
    )
    const nextDesc = typeof args.description === 'string' ? args.description.trim() : ''

    if (
      (nextTitle && nextTitle !== task.title) ||
      (nextPriority && nextPriority !== task.priority) ||
      (nextDesc && nextDesc !== task.description)
    ) {
      const prevTitle = task.title
      const prevPriority = task.priority
      const prevDesc = task.description
      await ctx.api.tasks.update({
        taskId: task.id,
        changes: {
          ...(nextTitle && nextTitle !== task.title ? { title: nextTitle } : {}),
          ...(nextPriority && nextPriority !== task.priority ? { priority: nextPriority } : {}),
          ...(nextDesc && nextDesc !== task.description ? { description: nextDesc } : {}),
        },
      })
      undoSteps.push(async () => {
        await ctx.api.tasks.update({
          taskId: task.id,
          changes: { title: prevTitle, priority: prevPriority, description: prevDesc },
        })
      })
      if (nextTitle && nextTitle !== task.title) changesSummary.push('título atualizado')
      if (nextPriority && nextPriority !== task.priority) {
        changesSummary.push(`prioridade → ${nextPriority === 'high' ? 'Alta' : 'Normal'}`)
      }
    }

    if (typeof args.blocked === 'boolean') {
      if (args.blocked && task.blockedReason === null) {
        const reason =
          typeof args.blockReason === 'string' && args.blockReason.trim()
            ? args.blockReason.trim()
            : 'Impedimento registrado via Kan.'
        await ctx.api.tasks.block({ taskId: task.id, reason })
        undoSteps.push(async () => {
          await ctx.api.tasks.unblock({ taskId: task.id })
        })
        changesSummary.push('bloqueada')
      } else if (!args.blocked && task.blockedReason !== null) {
        const prevReason = task.blockedReason
        await ctx.api.tasks.unblock({ taskId: task.id })
        undoSteps.push(async () => {
          await ctx.api.tasks.block({ taskId: task.id, reason: prevReason })
        })
        changesSummary.push('bloqueio resolvido')
      }
    }

    const addHours = typeof args.addHours === 'number' && args.addHours > 0 ? args.addHours : 0
    if (addHours > 0) {
      const detail = await ctx.api.tasks.get({ taskId: task.id })
      const myPart =
        detail.participations.find(
          (p) => p.participant.kind === 'user' && p.participant.userId === ctx.actor.userId,
        ) ?? detail.participations.find((p) => p.role === 'responsible')
      if (!myPart) {
        return {
          ok: false,
          error: `Não encontrei participação editável em ${task.key} para lançar horas.`,
        }
      }
      const prevHours = myPart.hours
      const nextHours = prevHours + addHours
      await ctx.api.participations.setHours({
        taskId: task.id,
        participationId: myPart.id,
        hours: formatHoursString(nextHours),
      })
      undoSteps.push(async () => {
        await ctx.api.participations.setHours({
          taskId: task.id,
          participationId: myPart.id,
          hours: formatHoursString(prevHours),
        })
      })
      changesSummary.push(
        `+${formatHoursString(addHours)}h (${formatHoursString(nextHours)}h total)`,
      )
    }

    const addSubtask = typeof args.addSubtask === 'string' ? args.addSubtask.trim() : ''
    if (addSubtask) {
      await ctx.api.tasks.checklist.add({ taskId: task.id, title: addSubtask })
      changesSummary.push('subtarefa adicionada')
    }

    const comment = typeof args.comment === 'string' ? args.comment.trim() : ''
    if (comment) {
      const createdComment = await ctx.api.tasks.comments.add({ taskId: task.id, body: comment })
      undoSteps.push(async () => {
        await ctx.api.tasks.comments.remove({ taskId: task.id, commentId: createdComment.id })
      })
      changesSummary.push('comentário registrado')
    }

    if (changesSummary.length === 0) {
      return {
        ok: false,
        error: `Nenhuma alteração necessária em ${task.key} (${task.title}).`,
      }
    }

    const summary = `${task.key} atualizada`
    const detail = changesSummary.join(' · ')
    const undoId = registerUndo(summary, async () => {
      for (let i = undoSteps.length - 1; i >= 0; i -= 1) {
        const step = undoSteps[i]
        if (step) await step()
      }
    })
    ctx.onMutated(summary)
    return { ok: true, summary, detail, undoId, data: { key: task.key, id: task.id } }
  } catch (err) {
    return { ok: false, error: formatError(err, `Não foi possível atualizar ${task.key}.`) }
  }
}

async function toolManageBacklog(
  ctx: KanRuntimeContext,
  args: Readonly<Record<string, unknown>>,
): Promise<ToolResult> {
  const action = typeof args.action === 'string' ? args.action : ''
  const project = pickTargetProject(ctx)
  if (!project) return { ok: false, error: 'Selecione um projeto ativo para mexer no Backlog.' }

  try {
    if (action === 'add') {
      const title = typeof args.title === 'string' ? args.title.trim() : ''
      if (!title) return { ok: false, error: 'Informe o título do item para o Backlog.' }
      const owner = findUserByName(
        ctx.users,
        typeof args.owner === 'string' ? args.owner : undefined,
      )
      const created = await ctx.api.backlog.add({
        projectId: project.id,
        title,
        ...(owner ? { responsibleId: owner.id } : {}),
      })
      const summary = `${created.key} adicionada ao Backlog`
      const detail = `${created.title} (${project.name})`
      const undoId = registerUndo(summary, async () => {
        await ctx.api.tasks.archive({ taskId: created.id })
      })
      ctx.onMutated(summary)
      return { ok: true, summary, detail, undoId }
    }

    if (action === 'send_to_board') {
      const itemRef = typeof args.itemId === 'string' ? args.itemId : ''
      const items = await ctx.api.backlog.list({ projectId: project.id })
      const target = findTaskInList(items, itemRef)
      if (!target) {
        return {
          ok: false,
          error: `Item "${itemRef}" não encontrado no Backlog de ${project.name}.`,
        }
      }
      await ctx.api.backlog.pull({ taskId: target.id, status: 'todo' })
      const summary = `${target.key} enviada ao Quadro`
      const detail = `${target.title} → A fazer`
      const undoId = registerUndo(summary, async () => {
        await ctx.api.backlog.sendBack({ taskId: target.id })
      })
      ctx.onMutated(summary)
      return { ok: true, summary, detail, undoId }
    }

    return { ok: false, error: 'Ação de Backlog não reconhecida.' }
  } catch (err) {
    return { ok: false, error: formatError(err, 'Não foi possível atualizar o Backlog.') }
  }
}

async function toolManageSprint(
  ctx: KanRuntimeContext,
  args: Readonly<Record<string, unknown>>,
): Promise<ToolResult> {
  const action = typeof args.action === 'string' ? args.action : ''
  const project = pickTargetProject(ctx)
  if (!project) return { ok: false, error: 'Selecione um projeto ativo para gerenciar a Sprint.' }

  try {
    const sprints = await ctx.api.sprints.list({ projectId: project.id, status: 'active' })
    const activeSprint = sprints[0]
    if (!activeSprint) {
      return { ok: false, error: `Não há Sprint ativa em ${project.name}.` }
    }

    if (action === 'update_goal') {
      const goal = typeof args.goal === 'string' ? args.goal.trim() : ''
      if (!goal) return { ok: false, error: 'Informe a nova meta da Sprint.' }
      const prevGoal = activeSprint.goal
      await ctx.api.sprints.update({ sprintId: activeSprint.id, goal })
      const summary = `Meta da ${activeSprint.label} atualizada`
      const undoId = registerUndo(summary, async () => {
        await ctx.api.sprints.update({ sprintId: activeSprint.id, goal: prevGoal })
      })
      ctx.onMutated(summary)
      return { ok: true, summary, detail: goal, undoId }
    }

    if (action === 'allocate_task') {
      const ref = typeof args.taskId === 'string' ? args.taskId : ''
      const board = await ctx.api.tasks.listBoard({ projectId: project.id })
      const task = findTaskInList(board.tasks, ref)
      if (!task) return { ok: false, error: `Tarefa "${ref}" não encontrada em ${project.name}.` }
      await ctx.api.sprints.addTask({ sprintId: activeSprint.id, taskId: task.id })
      const summary = `${task.key} alocada na ${activeSprint.label}`
      const undoId = registerUndo(summary, async () => {
        await ctx.api.sprints.removeTask({ sprintId: activeSprint.id, taskId: task.id })
      })
      ctx.onMutated(summary)
      return { ok: true, summary, detail: task.title, undoId }
    }

    if (action === 'close_sprint') {
      if (args.confirmed !== true) {
        const confirmation: KanConfirmationRequest = {
          id: `conf_${Date.now()}`,
          toolName: 'manage_sprint',
          actionTitle: `Encerrar ${activeSprint.label}`,
          detail: `Tarefas ainda não concluídas em "${activeSprint.name}" voltarão para o Backlog.`,
          pendingArgs: { action: 'close_sprint', confirmed: true },
        }
        return { ok: true, needsConfirmation: true, confirmation }
      }
      await ctx.api.sprints.close({
        sprintId: activeSprint.id,
        policy: 'return_to_backlog',
      })
      const summary = `${activeSprint.label} encerrada`
      ctx.onMutated(summary)
      return { ok: true, summary, detail: activeSprint.name }
    }

    return { ok: false, error: 'Ação de Sprint não reconhecida.' }
  } catch (err) {
    return { ok: false, error: formatError(err, 'Não foi possível atualizar a Sprint.') }
  }
}

async function toolRecordDaily(
  ctx: KanRuntimeContext,
  args: Readonly<Record<string, unknown>>,
): Promise<ToolResult> {
  const progress = typeof args.summary === 'string' ? args.summary.trim() : ''
  const nextStep = typeof args.nextStep === 'string' ? args.nextStep.trim() : ''
  const blocker = typeof args.blocker === 'string' ? args.blocker.trim() : ''
  if (!progress && !nextStep && !blocker) {
    return { ok: false, error: 'Conte rapidamente o que avançou hoje para registrar sua Daily.' }
  }
  try {
    const today = todayDateOnly()
    const prev = await ctx.api.daily.getToday({ date: today })
    await ctx.api.daily.save({
      date: today,
      answers: { progress, nextStep, blocker },
      noNews: false,
      taskRefs: [],
    })
    const summary = 'Daily de hoje salva'
    const detail = progress || nextStep || blocker
    const undoId = prev.entry
      ? registerUndo(summary, async () => {
          if (!prev.entry) return
          await ctx.api.daily.save({
            date: today,
            answers: prev.entry.answers,
            noNews: prev.entry.noNews,
            taskRefs: [...prev.entry.taskRefs],
          })
        })
      : undefined
    ctx.onMutated(summary)
    return { ok: true, summary, detail, ...(undoId ? { undoId } : {}) }
  } catch (err) {
    return { ok: false, error: formatError(err, 'Não foi possível salvar sua Daily.') }
  }
}

export async function executeKanTool(
  ctx: KanRuntimeContext,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<ToolResult> {
  switch (name) {
    case 'get_workspace_context':
      return { ok: true, data: await fetchWorkspaceSnapshot(ctx) }
    case 'create_task':
      return toolCreateTask(ctx, args)
    case 'update_task':
      return toolUpdateTask(ctx, args)
    case 'manage_backlog':
      return toolManageBacklog(ctx, args)
    case 'manage_sprint':
      return toolManageSprint(ctx, args)
    case 'record_daily':
      return toolRecordDaily(ctx, args)
    default:
      return { ok: false, error: `Ferramenta desconhecida: ${name}` }
  }
}

export async function confirmKanPendingAction(
  ctx: KanRuntimeContext,
  confirmation: KanConfirmationRequest,
): Promise<{ readonly ok: boolean; readonly receipt?: KanActionReceipt; readonly error?: string }> {
  const result = await executeKanTool(ctx, confirmation.toolName, confirmation.pendingArgs)
  if (!result.ok) return { ok: false, error: result.error ?? 'Falha ao confirmar ação.' }
  if (result.summary) {
    return {
      ok: true,
      receipt: {
        undoId: result.undoId ?? `done_${Date.now()}`,
        summary: result.summary,
        detail: result.detail ?? '',
      },
    }
  }
  return { ok: true }
}

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_workspace_context',
        description:
          'Lê o estado real do workspace AgileBox: papel ativo, projetos, usuários e tarefas do quadro.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'create_task',
        description:
          'Cria uma nova tarefa real no quadro AgileBox (respeitando os 5 estados oficiais e permissões do ator).',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Título objetivo da tarefa em português.' },
            project: { type: 'STRING', description: 'Nome ou ID opcional do projeto.' },
            status: {
              type: 'STRING',
              description:
                'Estado inicial: Planejamento, A fazer, Desenvolvendo, Revisar ou Concluído.',
            },
            assignee: { type: 'STRING', description: 'Nome do responsável.' },
            priority: { type: 'STRING', description: 'Alta ou Normal.' },
            description: { type: 'STRING', description: 'Descrição curta.' },
            subtasks: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Lista opcional de subtarefas.',
            },
            addToSprint: { type: 'BOOLEAN', description: 'Se true, também aloca na Sprint ativa.' },
          },
          required: ['title'],
        },
      },
      {
        name: 'update_task',
        description:
          'Atualiza uma tarefa existente (por código como AB-5 ou trecho do título): mudar estado, lançar horas, bloquear/desbloquear, adicionar subtarefa, editar título/prioridade ou comentar.',
        parameters: {
          type: 'OBJECT',
          properties: {
            taskId: {
              type: 'STRING',
              description: 'Código da tarefa (ex.: AB-5), ID ou trecho do título.',
            },
            title: { type: 'STRING' },
            status: { type: 'STRING', description: 'Novo estado entre os 5 oficiais.' },
            priority: { type: 'STRING', description: 'Alta ou Normal.' },
            addHours: { type: 'NUMBER', description: 'Horas a somar no registro (ex.: 1.5).' },
            blocked: {
              type: 'BOOLEAN',
              description: 'true para bloquear, false para desbloquear.',
            },
            blockReason: { type: 'STRING', description: 'Motivo do bloqueio.' },
            addSubtask: { type: 'STRING', description: 'Texto de uma nova subtarefa.' },
            comment: { type: 'STRING', description: 'Comentário a registrar na tarefa.' },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'manage_sprint',
        description:
          'Gerencia a Sprint ativa: alocar tarefa, atualizar meta ou solicitar encerramento da sprint.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', description: 'allocate_task | update_goal | close_sprint' },
            taskId: { type: 'STRING', description: 'Código ou título da tarefa para alocar.' },
            goal: { type: 'STRING', description: 'Nova meta da Sprint (para update_goal).' },
          },
          required: ['action'],
        },
      },
      {
        name: 'manage_backlog',
        description: 'Adiciona item no Backlog ou envia item existente do Backlog para o Quadro.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', description: 'add | send_to_board' },
            title: { type: 'STRING' },
            owner: { type: 'STRING' },
            itemId: { type: 'STRING', description: 'Código ou título ao usar send_to_board.' },
          },
          required: ['action'],
        },
      },
      {
        name: 'record_daily',
        description: 'Salva a atualização do dia (daily) do usuário atual.',
        parameters: {
          type: 'OBJECT',
          properties: {
            summary: { type: 'STRING', description: 'Resumo do que avançou hoje.' },
            nextStep: { type: 'STRING', description: 'Próximo passo opcional.' },
            blocker: { type: 'STRING', description: 'Impedimento opcional.' },
          },
          required: ['summary'],
        },
      },
    ],
  },
]

function buildSystemInstruction(ctx: KanRuntimeContext): string {
  return [
    'Você é o Kan, assistente do AgileBox — plataforma brasileira de organização de tarefas para times de TI focada em mínimo atrito.',
    'Regras obrigatórias do produto:',
    '1. Responda sempre em português do Brasil claro, direto e enxuto.',
    '2. Os únicos 5 estados oficiais de tarefa são, nesta ordem: Planejamento, A fazer, Desenvolvendo, Revisar, Concluído.',
    '3. Sempre que o usuário pedir para criar tarefa, mudar estado, lançar horas, bloquear/desbloquear, atualizar sprint/backlog ou registrar daily, chame as ferramentas disponíveis imediatamente — NÃO peça confirmação para ações comuns, pois o usuário tem o botão Desfazer no chat (exceto se manage_sprint retornar needsConfirmation).',
    `4. Usuário ativo agora: ${ctx.actor.name} (${ctx.actor.isManager ? 'Gestor — edições marcadas como Gestor' : 'Colaborador — vê só o próprio valor/hora'}).`,
    `5. Projeto selecionado: ${ctx.selectedProject?.name ?? 'Todos os projetos'}. Tela atual: ${ctx.currentScreenTitle}.`,
    '6. Nunca invente valores monetários R$ no modo Colaborador.',
  ].join('\n')
}

async function runLocalAssistant(ctx: KanRuntimeContext, userText: string): Promise<KanSendResult> {
  const text = userText.trim()
  const norm = normalizeText(text)
  const actions: KanActionReceipt[] = []
  const confirmations: KanConfirmationRequest[] = []

  const keyMatch = text.match(/\b([A-Z]{2,5}-\d+)\b/i)
  const taskRef = keyMatch?.[1]?.toUpperCase()

  if (/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|help|o que voce faz)/.test(norm)) {
    const projectLabel = ctx.selectedProject?.name ?? ctx.activeProjects[0]?.name ?? 'seu projeto'
    return {
      mode: 'local',
      text:
        `Oi! Sou o **Kan**. Mesmo sem conectar uma chave do Google AI Studio, consigo executar comandos diretos no **${projectLabel}** (com botão **Desfazer**):\n` +
        '• "Criar tarefa Validar webhook de pagamento em A fazer"\n' +
        '• "Mover AB-1 para Revisar"\n' +
        '• "Lançar 1,5h em AB-1"\n' +
        '• "Registrar daily: avancei nos testes, sem bloqueios"',
      actions,
      confirmations,
    }
  }

  if (
    /(quais tarefas|listar tarefas|resumo|status do projeto|o que esta bloqueado|bloqueios)/.test(
      norm,
    ) &&
    !/criar|mover|lancar|registrar|bloquear\s+[a-z]{2,5}-\d/.test(norm)
  ) {
    const snap = await fetchWorkspaceSnapshot(ctx)
    const blocked = snap.tasks.filter((t) => t.blocked)
    if (snap.tasks.length === 0) {
      return {
        mode: 'local',
        text: `Não há tarefas visíveis em **${snap.activeProjectName}** no momento.`,
        actions,
        confirmations,
      }
    }
    const lines = snap.tasks
      .slice(0, 6)
      .map((t) => `• ${t.key} (${t.status}${t.blocked ? ' · Bloqueada' : ''}): ${t.title}`)
    return {
      mode: 'local',
      text:
        `Em **${snap.activeProjectName}** há ${snap.tasks.length} tarefa(s) no quadro` +
        (blocked.length ? ` (${blocked.length} bloqueada(s))` : '') +
        `:\n${lines.join('\n')}`,
      actions,
      confirmations,
    }
  }

  if (/encerrar\s+sprint|fechar\s+sprint/.test(norm)) {
    const res = await executeKanTool(ctx, 'manage_sprint', { action: 'close_sprint' })
    if (res.needsConfirmation && res.confirmation) {
      confirmations.push(res.confirmation)
      return {
        mode: 'local',
        text: 'Antes de concluir o ciclo, confirme abaixo se deseja encerrar a Sprint ativa.',
        actions,
        confirmations,
      }
    }
    return {
      mode: 'local',
      text: res.error ?? 'Não foi possível iniciar o encerramento da Sprint.',
      actions,
      confirmations,
    }
  }

  if (
    /^(criar|cria|nova|adicionar|adiciona)\s+(uma\s+)?tarefa\b/.test(norm) ||
    /criar tarefa/.test(norm)
  ) {
    let cleanTitle = text
      .replace(
        /^(por favor,?\s*)?(criar|cria|nova|adicionar|adiciona)\s+(uma\s+)?tarefa\s*(:|-)?\s*/i,
        '',
      )
      .trim()
    const targetStatus = parseTaskStatusInput(text)
    const assigneeMatch = text.match(/\b(?:para|resp(?:ons[aá]vel)?\.?)\s+([A-Za-zÀ-ÿ]+)/i)
    const assigneeName = assigneeMatch?.[1]
    const prio = parsePriorityInput(text)

    cleanTitle = cleanTitle
      .replace(
        /\b(?:em|para\s+o?\s+estado|na\s+coluna)\s+(?:planejamento|a fazer|desenvolvendo|revisar|conclu[ií]do)\b/gi,
        '',
      )
      .replace(/\bprioridade\s+(?:alta|normal|m[eé]dia|baixa)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (assigneeName && findUserByName(ctx.users, assigneeName)) {
      cleanTitle = cleanTitle
        .replace(new RegExp(`\\b(?:para|resp(?:ons[aá]vel)?\\.?)\\s+${assigneeName}\\b`, 'i'), '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    }

    if (!cleanTitle) cleanTitle = 'Nova tarefa registrada pelo Kan'

    const res = await executeKanTool(ctx, 'create_task', {
      title: cleanTitle,
      ...(targetStatus ? { status: targetStatus } : {}),
      ...(assigneeName ? { assignee: assigneeName } : {}),
      ...(prio ? { priority: prio } : {}),
      addToSprint: /sprint/.test(norm),
    })

    if (res.ok && res.summary && res.undoId) {
      actions.push({ undoId: res.undoId, summary: res.summary, detail: res.detail ?? '' })
      return {
        mode: 'local',
        text: `Pronto! Criei a tarefa diretamente no quadro (**${res.summary}**).`,
        actions,
        confirmations,
      }
    }
    return {
      mode: 'local',
      text: res.error ?? 'Não foi possível criar a tarefa.',
      actions,
      confirmations,
    }
  }

  if (/backlog/.test(norm)) {
    const res =
      taskRef && /quadro|enviar|mover|puxar/.test(norm)
        ? await executeKanTool(ctx, 'manage_backlog', { action: 'send_to_board', itemId: taskRef })
        : await executeKanTool(ctx, 'manage_backlog', {
            action: 'add',
            title:
              text.replace(/.*backlog\s*(:|-|de|para)?\s*/i, '').trim() || 'Novo item no Backlog',
          })
    if (res.ok && res.summary && res.undoId) {
      actions.push({ undoId: res.undoId, summary: res.summary, detail: res.detail ?? '' })
      return { mode: 'local', text: `${res.summary}.`, actions, confirmations }
    }
    return {
      mode: 'local',
      text: res.error ?? 'Não foi possível atualizar o Backlog.',
      actions,
      confirmations,
    }
  }

  if (/sprint/.test(norm)) {
    const res = /meta/.test(norm)
      ? await executeKanTool(ctx, 'manage_sprint', {
          action: 'update_goal',
          goal: text.replace(/.*meta(?:\s+da\s+sprint)?\s*(:|para|-)?\s*/i, '').trim(),
        })
      : await executeKanTool(ctx, 'manage_sprint', {
          action: 'allocate_task',
          taskId: taskRef ?? text,
        })
    if (res.ok && res.summary && res.undoId) {
      actions.push({ undoId: res.undoId, summary: res.summary, detail: res.detail ?? '' })
      return { mode: 'local', text: `${res.summary}.`, actions, confirmations }
    }
    return {
      mode: 'local',
      text: res.error ?? 'Não foi possível atualizar a Sprint.',
      actions,
      confirmations,
    }
  }

  if (/(daily|atualizacao do dia|check-?in|fiz hoje|trabalhei em)/.test(norm)) {
    const cleanDaily = text
      .replace(/^(registrar\s+)?(a\s+)?(daily|atualiza[cç][aã]o\s+do\s+dia)\s*(:|-)?\s*/i, '')
      .trim()
    const res = await executeKanTool(ctx, 'record_daily', {
      summary: cleanDaily || 'Atualização diária registrada pelo Kan.',
    })
    if (res.ok && res.summary) {
      if (res.undoId) {
        actions.push({ undoId: res.undoId, summary: res.summary, detail: res.detail ?? '' })
      }
      return {
        mode: 'local',
        text: 'Atualização do dia salva com sucesso.',
        actions,
        confirmations,
      }
    }
    return {
      mode: 'local',
      text: res.error ?? 'Não foi possível salvar a Daily.',
      actions,
      confirmations,
    }
  }

  if (
    taskRef ||
    /(mover|mudar|passar|colocar|lancar|registrar|somar|bloquear|desbloquear|subtarefa|comentar)/.test(
      norm,
    )
  ) {
    const fallbackTaskKey = ctx.boardTasks[0]?.key
    const upd: Record<string, unknown> = { taskId: taskRef ?? fallbackTaskKey ?? '' }

    const stFound = parseTaskStatusInput(text)
    if (stFound) upd.status = stFound

    const hrMatch = text.match(/([+]?\d+(?:[.,]\d+)?)\s*h\b/i)
    if (hrMatch?.[1] && /(hora|lancar|lancamento|somar|registrar|adicionar|\+\d)/.test(norm)) {
      upd.addHours = Number.parseFloat(hrMatch[1].replace(',', '.').replace('+', ''))
    }

    if (/desbloquear|resolver bloqueio|tirar bloqueio/.test(norm)) {
      upd.blocked = false
    } else if (/bloquear|impedimento|travad/.test(norm)) {
      upd.blocked = true
      const motivo = text.match(/(?:motivo|porque|por)\s+(.+)$/i)
      upd.blockReason = motivo?.[1]?.trim() ?? 'Impedimento registrado via Kan.'
    }

    const subMatch = text.match(/subtarefa\s*[:-]?\s*(.+)$/i)
    if (subMatch?.[1]) {
      upd.addSubtask = subMatch[1].replace(/\s+em\s+[A-Z]{2,5}-\d+/i, '').trim()
    }

    const commMatch = text.match(/comentar(?:\s+em\s+[A-Z]{2,5}-\d+)?\s*[:-]?\s*(.+)$/i)
    if (commMatch?.[1]) {
      upd.comment = commMatch[1].trim()
    }

    const res = await executeKanTool(ctx, 'update_task', upd)
    if (res.ok && res.summary && res.undoId) {
      actions.push({ undoId: res.undoId, summary: res.summary, detail: res.detail ?? '' })
      return {
        mode: 'local',
        text: `Feito! **${res.summary}**. Se quiser reverter, clique em **Desfazer**.`,
        actions,
        confirmations,
      }
    }
    return {
      mode: 'local',
      text: res.error ?? 'Não foi possível atualizar a tarefa.',
      actions,
      confirmations,
    }
  }

  return {
    mode: 'local',
    text: 'Consigo criar ou atualizar tarefas, mover estados, lançar horas, registrar bloqueios, mexer em Sprint/Backlog e salvar sua Daily — ou respondo conversas livres conectando sua chave gratuita do Google AI Studio no botão **Chave AI** acima.',
    actions,
    confirmations,
  }
}

interface GeminiPart {
  readonly text?: string
  readonly functionCall?: {
    readonly name: string
    readonly args?: Readonly<Record<string, unknown>>
  }
  readonly functionResponse?: {
    readonly name: string
    readonly response: { readonly result: unknown }
  }
}

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly GeminiPart[]
    }
  }[]
  readonly error?: { readonly message?: string }
}

export async function sendKanMessage(
  ctx: KanRuntimeContext,
  historyMessages: readonly KanChatMessage[],
  userText: string,
): Promise<KanSendResult> {
  const apiKey = getKanApiKey()
  if (!apiKey) return runLocalAssistant(ctx, userText)

  const model = getKanModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const contents: Array<{ role: 'user' | 'model'; parts: readonly GeminiPart[] }> = []
  for (const msg of historyMessages.slice(-8)) {
    if (!msg.text) continue
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    })
  }
  contents.push({ role: 'user', parts: [{ text: userText }] })

  const collectedActions: KanActionReceipt[] = []
  const collectedConfirmations: KanConfirmationRequest[] = []

  try {
    for (let round = 0; round < 6; round += 1) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemInstruction(ctx) }] },
          contents,
          tools: GEMINI_TOOLS,
          generationConfig: { temperature: 0.35 },
        }),
      })

      const data = (await resp.json().catch(() => ({}))) as GeminiResponse
      if (!resp.ok) {
        throw new Error(data.error?.message ?? `HTTP ${resp.status}`)
      }

      const parts = data.candidates?.[0]?.content?.parts ?? []
      const fnCalls = parts.filter((p) => p.functionCall !== undefined)
      const textParts = parts
        .map((p) => p.text)
        .filter((t): t is string => typeof t === 'string' && t.length > 0)

      if (fnCalls.length === 0) {
        return {
          mode: 'gemini',
          text: textParts.join('\n').trim() || 'Pronto.',
          actions: collectedActions,
          confirmations: collectedConfirmations,
        }
      }

      contents.push({ role: 'model', parts })
      const fnResponses: GeminiPart[] = []

      for (const part of fnCalls) {
        const fc = part.functionCall
        if (!fc) continue
        const result = await executeKanTool(ctx, fc.name, fc.args ?? {})
        if (result.ok && result.needsConfirmation && result.confirmation) {
          collectedConfirmations.push(result.confirmation)
        } else if (result.ok && result.undoId && result.summary) {
          collectedActions.push({
            undoId: result.undoId,
            summary: result.summary,
            detail: result.detail ?? '',
          })
        }
        fnResponses.push({
          functionResponse: {
            name: fc.name,
            response: { result },
          },
        })
      }

      contents.push({ role: 'user', parts: fnResponses })
    }

    return {
      mode: 'gemini',
      text:
        collectedActions.length > 0
          ? 'Operações concluídas no workspace.'
          : 'Limite de chamadas de ferramenta atingido.',
      actions: collectedActions,
      confirmations: collectedConfirmations,
    }
  } catch (err) {
    const message = formatError(err, 'Erro desconhecido')
    return {
      mode: 'error',
      error: message,
      text: `Não consegui consultar o Google AI Studio agora (${message}). Confira sua chave API ou teste um comando rápido no modo local.`,
      actions: collectedActions,
      confirmations: collectedConfirmations,
    }
  }
}

export async function testKanApiKey(
  customKey?: string,
  customModel?: string,
): Promise<{ readonly ok: boolean; readonly message: string }> {
  const key = (customKey ?? getKanApiKey()).trim()
  const model = customModel ?? getKanModel()
  if (!key) return { ok: false, message: 'Cole sua chave API do Google AI Studio.' }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    })
    if (!resp.ok) {
      const errBody = (await resp.json().catch(() => ({}))) as GeminiResponse
      return { ok: false, message: errBody.error?.message ?? `Erro HTTP ${resp.status}` }
    }
    return { ok: true, message: `Conexão validada com ${model}!` }
  } catch (err) {
    return { ok: false, message: `Falha de rede: ${formatError(err, 'erro de conexão')}` }
  }
}
