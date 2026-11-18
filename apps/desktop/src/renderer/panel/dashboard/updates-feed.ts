import { format, isSameDay, parseISO, subDays } from 'date-fns'
import type { DashboardInsights } from './dashboard-format'

type ProjectMethod = DashboardInsights['projects'][number]['method']

/** Tipo de atualização: só os que têm dado hoje (needs do domínio e categorias da linha do tempo). */
export type FeedFilter =
  'acceptance' | 'deadline' | 'estimate' | 'wip' | 'status' | 'comment' | 'other'
/** Visões da tela Atualizações. */
export type FeedView = 'exige' | 'hoje' | 'marcos'

export const FEED_FILTER_ORDER: readonly FeedFilter[] = [
  'acceptance',
  'deadline',
  'estimate',
  'wip',
  'status',
  'comment',
  'other',
]

export const FEED_FILTER_LABELS: Readonly<Record<FeedFilter, string>> = {
  acceptance: 'Aceite pendente',
  deadline: 'Marco e prazo',
  estimate: 'Estimativa e custo',
  wip: 'WIP e paradas',
  status: 'Mudança de estado',
  comment: 'Comentários',
  other: 'Outras edições',
}

export type FeedTone = 'danger' | 'warning' | 'neutral'

/** Para onde o botão da linha leva. */
export type FeedAction =
  | { readonly kind: 'board'; readonly projectId: string }
  | { readonly kind: 'schedule'; readonly projectId: string }
  | { readonly kind: 'task'; readonly taskId: string }

export interface FeedEntry {
  readonly key: string
  readonly filter: FeedFilter
  readonly typeLabel: string
  readonly tone: FeedTone
  /** Hora do movimento; nula quando o sinal não tem hora (um "Em aberto"). */
  readonly at: string | null
  /** Título: nome da tarefa, ou o próprio texto do sinal. */
  readonly headline: string
  /** Frase do que aconteceu (sem o nome de quem fez). */
  readonly detail: string | null
  readonly projectId: string
  readonly projectName: string
  readonly projectMethod: ProjectMethod
  readonly actorUserId: string | null
  readonly actorName: string | null
  readonly asManager: boolean
  readonly action: FeedAction
  readonly actionLabel: string
  readonly taskId: string | null
}

export interface FeedFilters {
  readonly view: FeedView
  readonly types: ReadonlySet<FeedFilter>
  readonly projects: ReadonlySet<string>
  readonly people: ReadonlySet<string>
  readonly groupByTask: boolean
  /** "Mostrar minhas edições": sem ela, as edições do gestor (marcadas Gestor) ficam de fora. */
  readonly showOwn: boolean
}

export interface FeedGroup {
  readonly key: string
  readonly label: string
  readonly items: readonly FeedItem[]
}

/** Um item da lista: uma entrada, ou uma tarefa com as outras edições do dia agrupadas. */
export interface FeedItem {
  readonly key: string
  readonly head: FeedEntry
  readonly rest: readonly FeedEntry[]
}

export interface FeedModel {
  readonly open: readonly FeedItem[]
  readonly days: readonly FeedGroup[]
  readonly visible: number
  readonly total: number
  readonly viewCounts: Readonly<Record<FeedView, number>>
  readonly typeCounts: Readonly<Record<FeedFilter, number>>
}

type Update = DashboardInsights['updates'][number]
type Need = DashboardInsights['needs'][number]

const NEED_FILTER: Readonly<Record<Need['kind'], FeedFilter>> = {
  wip: 'wip',
  milestone: 'deadline',
  acceptance: 'acceptance',
}

const UPDATE_FILTER: Readonly<Record<Update['category'], FeedFilter>> = {
  status: 'status',
  estimate: 'estimate',
  deadline: 'deadline',
  comment: 'comment',
  other: 'other',
}

const TONE: Readonly<Record<FeedFilter, FeedTone>> = {
  acceptance: 'warning',
  deadline: 'warning',
  estimate: 'warning',
  wip: 'danger',
  status: 'neutral',
  comment: 'neutral',
  other: 'neutral',
}

function needEntry(need: Need): FeedEntry {
  const filter = NEED_FILTER[need.kind]
  const action: FeedAction =
    need.kind === 'wip'
      ? { kind: 'board', projectId: need.projectId }
      : need.kind === 'milestone'
        ? { kind: 'schedule', projectId: need.projectId }
        : { kind: 'task', taskId: need.taskId ?? '' }
  return {
    key: need.id,
    filter,
    typeLabel: FEED_FILTER_LABELS[filter],
    tone: TONE[filter],
    at: need.at,
    headline: need.text,
    detail: null,
    projectId: need.projectId,
    projectName: need.projectName,
    projectMethod: null,
    actorUserId: null,
    actorName: null,
    asManager: false,
    action,
    actionLabel:
      need.kind === 'wip'
        ? 'Ver quadro'
        : need.kind === 'milestone'
          ? 'Abrir cronograma'
          : 'Revisar',
    taskId: need.taskId,
  }
}

function updateEntry(update: Update): FeedEntry {
  const filter = UPDATE_FILTER[update.category]
  return {
    key: update.id,
    filter,
    typeLabel: FEED_FILTER_LABELS[filter],
    tone: TONE[filter],
    at: update.at,
    headline: update.taskTitle,
    detail: update.text,
    projectId: update.projectId,
    projectName: update.projectName,
    projectMethod: update.projectMethod,
    actorUserId: update.actorUserId,
    actorName: update.actorName,
    asManager: update.asManager,
    action: { kind: 'task', taskId: update.taskId },
    actionLabel: 'Abrir tarefa',
    taskId: update.taskId,
  }
}

/** Sinais "Em aberto" (needs) e movimentos (updates), já com nome de tipo, tom e ação. */
export function feedEntries(insights: DashboardInsights): {
  readonly needs: readonly FeedEntry[]
  readonly events: readonly FeedEntry[]
} {
  return {
    needs: insights.needs.map(needEntry),
    events: insights.updates.map(updateEntry),
  }
}

function dayKey(at: string): string {
  return format(parseISO(at), 'yyyy-MM-dd')
}

/** Rótulo do dia, contado a partir de `now` (não do relógio): "Hoje", "Ontem" ou dia e mês. */
function dayLabel(at: string, now: string): string {
  const date = parseISO(at)
  const reference = parseISO(now)
  if (isSameDay(date, reference)) return 'Hoje'
  if (isSameDay(date, subDays(reference, 1))) return 'Ontem'
  return format(date, 'dd/MM')
}

function groupItems(entries: readonly FeedEntry[], groupByTask: boolean): FeedItem[] {
  if (!groupByTask) return entries.map((entry) => ({ key: entry.key, head: entry, rest: [] }))
  const items: { key: string; head: FeedEntry; rest: FeedEntry[] }[] = []
  const byTask = new Map<string, { key: string; head: FeedEntry; rest: FeedEntry[] }>()
  for (const entry of entries) {
    const taskKey = entry.taskId ?? entry.key
    const existing = byTask.get(taskKey)
    if (existing) existing.rest.push(entry)
    else {
      const item = { key: entry.key, head: entry, rest: [] as FeedEntry[] }
      byTask.set(taskKey, item)
      items.push(item)
    }
  }
  return items
}

/**
 * Monta a tela Atualizações: aplica a visão, os filtros de tipo, projeto, pessoa e "minhas edições",
 * agrupa por dia e (se marcado) por tarefa dentro do dia. Os totais das visões e dos tipos não
 * mudam com os filtros, para que os números da barra lateral digam o que existe.
 */
export function buildFeed(
  insights: DashboardInsights,
  filters: FeedFilters,
  now: string,
): FeedModel {
  const { needs, events } = feedEntries(insights)
  const today = (entry: FeedEntry) =>
    entry.at !== null && isSameDay(parseISO(entry.at), parseISO(now))

  const viewCounts: Record<FeedView, number> = {
    exige: needs.length,
    hoje: events.filter(today).length,
    marcos:
      events.filter((entry) => entry.filter === 'deadline').length +
      needs.filter((entry) => entry.filter === 'deadline').length,
  }
  const typeCounts = Object.fromEntries(
    FEED_FILTER_ORDER.map((filter) => [
      filter,
      needs.filter((entry) => entry.filter === filter).length +
        events.filter((entry) => entry.filter === filter).length,
    ]),
  ) as Record<FeedFilter, number>

  const keep = (entry: FeedEntry) =>
    filters.types.has(entry.filter) && filters.projects.has(entry.projectId)
  const viewNeeds =
    filters.view === 'hoje'
      ? []
      : needs.filter((entry) => filters.view !== 'marcos' || entry.filter === 'deadline')
  const viewEvents = events.filter((entry) => {
    if (filters.view === 'exige') return false
    if (filters.view === 'marcos') return entry.filter === 'deadline'
    return today(entry)
  })
  const shownEvents = viewEvents
    .filter(keep)
    .filter((entry) => entry.actorUserId === null || filters.people.has(entry.actorUserId))
    .filter((entry) => filters.showOwn || !entry.asManager)
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
  const openNeeds = viewNeeds.filter(keep)
  // Sinal com hora cai no dia dele (desenho: "Hoje" e "Ontem"); sinal sem hora (marco) fica em "Em aberto".
  const dated = openNeeds.filter((entry) => entry.at !== null)
  const undated = openNeeds.filter((entry) => entry.at === null)
  const dayEntries = [...dated, ...shownEvents].sort((a, b) =>
    (b.at ?? '').localeCompare(a.at ?? ''),
  )

  const byDay = new Map<string, FeedEntry[]>()
  for (const entry of dayEntries) {
    const key = dayKey(entry.at ?? now)
    byDay.set(key, [...(byDay.get(key) ?? []), entry])
  }
  const days: FeedGroup[] = [...byDay.entries()].map(([key, entries]) => ({
    key,
    label: dayLabel(entries[0]!.at ?? now, now),
    items: groupItems(entries, filters.groupByTask),
  }))

  return {
    open: groupItems(undated, false),
    days,
    visible: openNeeds.length + shownEvents.length,
    total: insights.updates.length,
    viewCounts,
    typeCounts,
  }
}

export interface FeedActionHandlers {
  readonly onOpenProject: (projectId: string, screen: 'board' | 'schedule') => void
  readonly onOpenTask: (taskId: string) => void
}

/** Leva à tela do botão da linha (quadro, cronograma ou tarefa). */
export function runFeedAction(action: FeedAction, handlers: FeedActionHandlers): void {
  if (action.kind === 'board') handlers.onOpenProject(action.projectId, 'board')
  else if (action.kind === 'schedule') handlers.onOpenProject(action.projectId, 'schedule')
  else if (action.taskId) handlers.onOpenTask(action.taskId)
}
