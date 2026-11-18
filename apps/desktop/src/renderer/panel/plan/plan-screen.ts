import type { SprintDto, TaskDto, WbsRowDto, WbsViewDto } from '@agilebox/contract'
import { sumHours, weekdayDate, workingDays } from '../sprints/sprint-rules'
import { shortDate } from '../sprints/DraftsTab'

/**
 * Plano do projeto híbrido (telas 17 e 18). Tudo sai dos dados que o app já tem: a EAP (entregas,
 * tarefas e marcos), as sprints do projeto e os itens de cada sprint. A faixa de uma entrega vai da
 * primeira à última sprint que tem tarefas dela; a entrega não tem data própria no app.
 */

type WbsDeliverable = Extract<WbsRowDto, { kind: 'deliverable' }>
type WbsTask = Extract<WbsRowDto, { kind: 'task' }>
type DeliverableMilestone = WbsDeliverable['totals']['milestones'][number]

const DAY_MS = 86_400_000
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const planCopy = {
  title: 'Plano',
  noProject: 'Escolha um projeto para ver o plano.',
  loading: 'Carregando o plano…',
  loadError: 'Não foi possível carregar o plano deste projeto.',
  retry: 'Tentar de novo',
  noDeliverables: 'Nenhuma entrega cadastrada.',
  noDeliverablesHint: 'Cadastre as entregas na EAP para ver o plano.',
  noCurrent: 'Todas as entregas estão concluídas.',
  noDates: 'Sem datas para desenhar a linha do tempo.',
  openActive: (number: number) => `Abrir Sprint ${number}`,
  timelineLabel: 'Linha do tempo do projeto',
  laneEntregas: 'Entregas',
  laneMarcos: 'Marcos',
  laneSprints: 'Sprints',
  currentLabel: 'Entrega atual',
  nextTitle: 'Próximas entregas',
  nextEmpty:
    'Só a entrega e o marco, sem itens ainda. No híbrido isso é normal: o detalhe chega perto da hora.',
  noNext: 'Nenhuma outra entrega em aberto.',
  noMilestone: 'Sem marco ligado a esta entrega.',
  sprintsOfDeliverable: (text: string) =>
    text === '' ? 'Sem sprint com itens desta entrega.' : `Sprints desta entrega: ${text}`,
  noDeliverableContext: 'Sem entrega: os itens desta sprint não estão ligados à EAP.',
  plannedHours: (hours: string) => `${hours} planejadas nesta sprint`,
  outsideTitle: (count: number) => (count === 1 ? 'Item fora da entrega' : 'Itens fora da entrega'),
  outsideText: (count: number) =>
    count === 1
      ? 'Este item está na sprint, mas não é desta entrega. Ele não está nas entregas planejadas.'
      : `${count} itens estão na sprint, mas não são desta entrega. Eles não estão nas entregas planejadas.`,
  remainingLabel: 'Falta na entrega',
  milestoneLabel: 'Marco',
  howTitle: 'Como o híbrido funciona',
  howSteps: [
    {
      lead: 'Em cima é planejado.',
      text: 'Entregas e marcos têm data e são aprovados por quem acompanha de fora.',
    },
    {
      lead: 'Dentro é adaptável.',
      text: 'Cada entrega tem seu backlog, e as sprints refinam e trocam os itens.',
    },
    {
      lead: 'As duas se encontram no marco.',
      text: 'A última sprint de cada entrega termina no dia do marco. Item novo fora da entrega pede aprovação.',
    },
  ],
  sprintClosed: 'Concluída',
  sprintActive: 'Em andamento',
  sprintDraft: 'Planejada',
  endsOnMilestone: 'termina no marco',
  endsOn: (date: string) => `termina em ${shortDate(date)}`,
  hoursText: (hours: number) => `${formatNumber(hours)} h`,
  itemsText: (count: number) => (count === 1 ? '1 item' : `${count} itens`),
  unestimatedText: (count: number) => `${count} sem estimativa`,
  daysAhead: (days: number) => (days === 0 ? 'hoje' : days === 1 ? '1 dia' : `${days} dias`),
  daysBehind: (days: number) => (days === 1 ? '1 dia atrás' : `${days} dias atrás`),
} as const

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

/** Dia de calendário como número (dias desde a época), para medir distâncias sem fuso. */
export function dayNumber(date: string): number {
  const [year = 1970, month = 1, day = 1] = date.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

function dateOfDay(day: number): Date {
  return new Date(day * DAY_MS)
}

export interface PlanSprintChip {
  readonly id: string
  readonly label: string
  readonly status: SprintDto['status']
  readonly left: number
  readonly width: number
}

export interface PlanBar {
  readonly id: string
  readonly label: string
  readonly meta: string
  readonly left: number
  readonly width: number
  readonly lane: number
  readonly current: boolean
}

export interface PlanMilestoneMark {
  readonly id: string
  readonly title: string
  readonly date: string
  readonly left: number
}

export interface PlanSprintLine {
  readonly sprintId: string
  readonly number: number
  readonly text: string
}

export interface PlanCurrent {
  readonly id: string
  readonly label: string
  readonly progress: number
  readonly milestone: string | null
  readonly sprints: readonly PlanSprintLine[]
  readonly remaining: { readonly items: number; readonly hours: number }
}

export interface PlanNext {
  readonly id: string
  readonly label: string
  readonly progress: number
  readonly description: string
}

export interface PlanModel {
  /** Nulo quando não há sprint nem marco com data: a linha do tempo não tem o que desenhar. */
  readonly timeline: {
    readonly months: readonly { readonly label: string; readonly left: number }[]
    readonly today: number | null
  } | null
  readonly sprints: readonly PlanSprintChip[]
  readonly bars: readonly PlanBar[]
  readonly laneCount: number
  readonly milestones: readonly PlanMilestoneMark[]
  readonly current: PlanCurrent | null
  readonly next: readonly PlanNext[]
  /** Sprint ativa e a entrega em que ela está aberta (a de mais itens), para o botão "Abrir Sprint N". */
  readonly activeSprint: {
    readonly id: string
    readonly number: number
    readonly deliverableId: string | null
  } | null
}

/** Itens de cada sprint (detalhe), pelo id da sprint. Sprint sem detalhe carregado conta como vazia. */
export type SprintItemsById = Readonly<Record<string, readonly TaskDto[] | undefined>>

interface Tree {
  readonly topLevel: readonly WbsDeliverable[]
  readonly deliverables: ReadonlyMap<string, WbsDeliverable>
  readonly subtree: (rootId: string) => ReadonlySet<string>
  readonly topOf: (deliverableId: string | null) => string | null
  readonly tasksOf: (rootId: string) => readonly WbsTask[]
}

function buildTree(wbs: WbsViewDto): Tree {
  const rows = wbs.deliverables
  const deliverables = new Map<string, WbsDeliverable>()
  const tasks: WbsTask[] = []
  for (const row of rows) {
    if (row.kind === 'deliverable') deliverables.set(row.id, row)
    else tasks.push(row)
  }
  const topLevel = [...deliverables.values()].filter((row) => row.parentId === null)
  const topOf = (deliverableId: string | null): string | null => {
    let current = deliverableId === null ? undefined : deliverables.get(deliverableId)
    let guard = 0
    while (current && current.parentId !== null && guard < 10) {
      current = deliverables.get(current.parentId)
      guard += 1
    }
    return current ? current.id : null
  }
  const subtree = (rootId: string): ReadonlySet<string> => {
    const ids = new Set<string>([rootId])
    let grew = true
    while (grew) {
      grew = false
      for (const row of deliverables.values()) {
        if (row.parentId !== null && ids.has(row.parentId) && !ids.has(row.id)) {
          ids.add(row.id)
          grew = true
        }
      }
    }
    return ids
  }
  const tasksOf = (rootId: string) => {
    const ids = subtree(rootId)
    return tasks.filter((task) => ids.has(task.deliverableId))
  }
  return { topLevel, deliverables, subtree, topOf, tasksOf }
}

/** Entrega (de topo) com mais itens na sprint: é a entrega em que a sprint "está aberta". */
export function dominantDeliverable(
  items: readonly TaskDto[],
  tree: {
    readonly topOf: (id: string | null) => string | null
    readonly topLevel: readonly WbsDeliverable[]
  },
): string | null {
  const counts = new Map<string, number>()
  for (const item of items) {
    const top = tree.topOf(item.deliverableId ?? null)
    if (top) counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const deliverable of tree.topLevel) {
    const count = counts.get(deliverable.id) ?? 0
    if (count > bestCount) {
      best = deliverable.id
      bestCount = count
    }
  }
  return best
}

/** Sprints com itens de uma entrega (de topo e suas subentregas), da mais antiga para a mais nova. */
function sprintsOf(
  rootId: string,
  sorted: readonly SprintDto[],
  itemsById: SprintItemsById,
  subtreeIds: ReadonlySet<string>,
): { readonly sprint: SprintDto; readonly items: readonly TaskDto[] }[] {
  return sorted
    .map((sprint) => ({
      sprint,
      items: (itemsById[sprint.id] ?? []).filter(
        (item) => item.deliverableId != null && subtreeIds.has(item.deliverableId),
      ),
    }))
    .filter((entry) => entry.items.length > 0)
}

/** Monta o plano da tela 17 a partir da EAP, das sprints e dos itens de cada sprint. */
export function buildPlanModel({
  wbs,
  sprints,
  itemsById,
  today,
}: {
  readonly wbs: WbsViewDto
  readonly sprints: readonly SprintDto[]
  readonly itemsById: SprintItemsById
  readonly today: string
}): PlanModel {
  const tree = buildTree(wbs)
  const sorted = [...sprints].sort((a, b) => a.number - b.number)
  const todayDay = dayNumber(today)

  // Faixa de cada entrega: da primeira à última sprint com itens dela.
  const spans = tree.topLevel.map((deliverable) => {
    const found = sprintsOf(deliverable.id, sorted, itemsById, tree.subtree(deliverable.id))
    if (found.length === 0) return { deliverable, start: null, end: null, found }
    const start = Math.min(...found.map((entry) => dayNumber(entry.sprint.plannedStart)))
    const end = Math.max(...found.map((entry) => dayNumber(entry.sprint.plannedEnd)))
    return { deliverable, start, end, found }
  })

  // Escala: cobre sprints e marcos com data.
  const dated: number[] = []
  for (const sprint of sorted) {
    dated.push(dayNumber(sprint.plannedStart), dayNumber(sprint.plannedEnd))
  }
  for (const milestone of wbs.milestones) dated.push(dayNumber(milestone.dueOn))
  const scaleStart = dated.length > 0 ? Math.min(...dated) : null
  const scaleEnd = dated.length > 0 ? Math.max(...dated) + 1 : null
  const pct = (day: number) =>
    scaleStart === null || scaleEnd === null
      ? 0
      : ((day - scaleStart) / (scaleEnd - scaleStart)) * 100

  const timeline =
    scaleStart === null || scaleEnd === null
      ? null
      : {
          months: monthTicks(scaleStart, scaleEnd).map((tick) => ({
            label: tick.label,
            left: pct(tick.day),
          })),
          today: todayDay >= scaleStart && todayDay < scaleEnd ? pct(todayDay) : null,
        }

  const sprintChips: PlanSprintChip[] = sorted.map((sprint) => ({
    id: sprint.id,
    label: `S${sprint.number}`,
    status: sprint.status,
    left: pct(dayNumber(sprint.plannedStart)),
    width: pct(dayNumber(sprint.plannedEnd) + 1) - pct(dayNumber(sprint.plannedStart)),
  }))

  // Barras: uma faixa por entrega; as que se sobrepõem no tempo vão para outra linha.
  const placed = spans
    .filter((span) => span.start !== null && span.end !== null)
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
  const laneEnds: number[] = []
  const bars: PlanBar[] = []
  const current = currentDeliverableId(tree.topLevel)
  for (const span of placed) {
    const start = span.start ?? 0
    const end = span.end ?? 0
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end + 1)
    } else {
      laneEnds[lane] = end + 1
    }
    bars.push({
      id: span.deliverable.id,
      label: `${span.deliverable.code} · ${span.deliverable.title}`,
      meta: `${shortDate(dateOfDayIso(start))} – ${shortDate(dateOfDayIso(end))} · ${span.deliverable.totals.progress}%`,
      left: pct(start),
      width: pct(end + 1) - pct(start),
      lane,
      current: span.deliverable.id === current,
    })
  }

  const milestones: PlanMilestoneMark[] = [...wbs.milestones]
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      date: shortDate(milestone.dueOn),
      left: pct(dayNumber(milestone.dueOn)),
    }))

  const currentDeliverable = current
    ? (tree.topLevel.find((deliverable) => deliverable.id === current) ?? null)
    : null
  const currentCard =
    currentDeliverable === null
      ? null
      : buildCurrent(currentDeliverable, tree, sorted, itemsById, today)

  const currentIndex = currentDeliverable
    ? tree.topLevel.findIndex((deliverable) => deliverable.id === currentDeliverable.id)
    : -1
  const next: PlanNext[] = tree.topLevel
    .slice(currentIndex + 1)
    .filter((deliverable) => deliverable.totals.progress < 100)
    .map((deliverable) => {
      const tasks = tree.tasksOf(deliverable.id)
      const pending = tasks.filter((task) => !task.done)
      return {
        id: deliverable.id,
        label: `${deliverable.code} · ${deliverable.title}`,
        progress: deliverable.totals.progress,
        description:
          tasks.length === 0
            ? planCopy.nextEmpty
            : `${planCopy.itemsText(pending.length)}, ${planCopy.unestimatedText(
                pending.filter((task) => task.estimatedHours == null).length,
              )}`,
      }
    })

  const active = sorted.find((sprint) => sprint.status === 'active') ?? null
  const activeItems = active ? (itemsById[active.id] ?? []) : []
  const activeSprint = active
    ? {
        id: active.id,
        number: active.number,
        deliverableId: dominantDeliverable(activeItems, tree),
      }
    : null

  return {
    timeline,
    sprints: sprintChips,
    bars,
    laneCount: Math.max(1, laneEnds.length),
    milestones,
    current: currentCard,
    next,
    activeSprint,
  }
}

/** Primeira entrega de topo que ainda não chegou a 100%: a "entrega atual". */
function currentDeliverableId(topLevel: readonly WbsDeliverable[]): string | null {
  return topLevel.find((deliverable) => deliverable.totals.progress < 100)?.id ?? null
}

function buildCurrent(
  deliverable: WbsDeliverable,
  tree: Tree,
  sorted: readonly SprintDto[],
  itemsById: SprintItemsById,
  today: string,
): PlanCurrent {
  const milestones = [...deliverable.totals.milestones].sort((a, b) =>
    a.dueOn.localeCompare(b.dueOn),
  )
  const todayDay = dayNumber(today)
  const nextMilestone =
    milestones.find((milestone) => dayNumber(milestone.dueOn) >= todayDay) ??
    milestones[milestones.length - 1] ??
    null
  const sprintLines = sprintsOf(
    deliverable.id,
    sorted,
    itemsById,
    tree.subtree(deliverable.id),
  ).map(({ sprint, items }) => {
    const hours = items.reduce((total, item) => total + (item.estimatedHours ?? 0), 0)
    const endsOnMilestone = milestones.some((milestone) => milestone.dueOn === sprint.plannedEnd)
    const endText = endsOnMilestone ? planCopy.endsOnMilestone : planCopy.endsOn(sprint.plannedEnd)
    const text =
      sprint.status === 'closed'
        ? `${planCopy.sprintClosed} · ${planCopy.hoursText(hours)}`
        : `${sprint.status === 'active' ? planCopy.sprintActive : planCopy.sprintDraft} · ${endText}`
    return { sprintId: sprint.id, number: sprint.number, text }
  })
  const pending = tree.tasksOf(deliverable.id).filter((task) => !task.done)
  return {
    id: deliverable.id,
    label: `${deliverable.code} · ${deliverable.title}`,
    progress: deliverable.totals.progress,
    milestone: nextMilestone
      ? `${nextMilestone.title} · ${weekdayDate(nextMilestone.dueOn)} · ${daysFromToday(
          dayNumber(nextMilestone.dueOn) - todayDay,
        )}`
      : null,
    sprints: sprintLines,
    remaining: {
      items: pending.length,
      hours: pending.reduce((total, task) => total + (task.estimatedHours ?? 0), 0),
    },
  }
}

function daysFromToday(delta: number): string {
  return delta >= 0 ? planCopy.daysAhead(delta) : planCopy.daysBehind(-delta)
}

function dateOfDayIso(day: number): string {
  return dateOfDay(day).toISOString().slice(0, 10)
}

/** Um tique por mês dentro da escala. O primeiro é o mês do início, na borda esquerda. */
function monthTicks(startDay: number, endDay: number): { label: string; day: number }[] {
  const ticks: { label: string; day: number }[] = []
  const first = dateOfDay(startDay)
  let year = first.getUTCFullYear()
  let month = first.getUTCMonth()
  ticks.push({ label: MONTHS[month] ?? '', day: startDay })
  for (;;) {
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
    const day = Date.UTC(year, month, 1) / DAY_MS
    if (day >= endDay) break
    ticks.push({ label: MONTHS[month] ?? '', day })
  }
  return ticks
}

/** Dia de hoje dentro de uma sprint: dia útil X de Y, como no cabeçalho do design (tela 18). */
export function sprintDayText(sprint: SprintDto, today: string): string | null {
  if (sprint.status !== 'active') return null
  const total = workingDays(sprint.plannedStart, sprint.plannedEnd)
  const day = Math.min(workingDays(sprint.plannedStart, today), total)
  if (day < 1) return null
  return `dia ${day} de ${total}`
}

export interface SprintContextItem {
  readonly item: TaskDto
  /** Selo: "E1" (entrega de topo do item) ou "fora da EAP" (sem entrega). */
  readonly tag: string
  /** Fora da entrega que a sprint está mostrando (ou sem entrega). */
  readonly outside: boolean
}

export interface SprintContext {
  readonly deliverable: {
    readonly id: string
    readonly code: string
    readonly title: string
    readonly label: string
    readonly progress: number
    readonly sprintsText: string
    readonly milestone: string | null
  } | null
  readonly goal: string | null
  readonly hours: number
  readonly dayText: string | null
  readonly items: readonly SprintContextItem[]
  readonly outside: readonly TaskDto[]
}

/** Contexto da sprint 18: a entrega em que ela está aberta, o marco, a meta e o selo de cada item. */
export function buildSprintContext({
  wbs,
  sprint,
  sprints,
  itemsById,
  items,
  deliverableId,
  today,
}: {
  readonly wbs: WbsViewDto
  readonly sprint: SprintDto
  readonly sprints: readonly SprintDto[]
  readonly itemsById: SprintItemsById
  readonly items: readonly TaskDto[]
  readonly deliverableId: string | null
  readonly today: string
}): SprintContext {
  const tree = buildTree(wbs)
  const sorted = [...sprints].sort((a, b) => a.number - b.number)
  const top = deliverableId ? (tree.deliverables.get(deliverableId) ?? null) : null
  const subtreeIds = top ? tree.subtree(top.id) : new Set<string>()

  const contextItems: SprintContextItem[] = items.map((item) => {
    const itemTop = tree.topOf(item.deliverableId ?? null)
    const itemTopRow = itemTop ? tree.deliverables.get(itemTop) : undefined
    const tag = itemTopRow ? `E${itemTopRow.code}` : 'fora da EAP'
    const outside = top === null ? true : itemTop !== top.id
    return { item, tag, outside }
  })

  let deliverable: SprintContext['deliverable'] = null
  if (top) {
    const found = sprintsOf(top.id, sorted, itemsById, subtreeIds)
    const milestones = [...top.totals.milestones].sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    const first: DeliverableMilestone | undefined = milestones[0]
    deliverable = {
      id: top.id,
      code: top.code,
      title: top.title,
      label: `${top.code} · ${top.title}`,
      progress: top.totals.progress,
      sprintsText:
        found.length === 0 ? '' : found.map((entry) => `S${entry.sprint.number}`).join(', '),
      milestone: first
        ? `${first.title} · ${weekdayDate(first.dueOn)}${
            first.dueOn === sprint.plannedEnd ? ' · mesmo dia do fim da sprint' : ''
          }`
        : null,
    }
  }

  return {
    deliverable,
    goal: sprint.goal,
    hours: sumHours(items).estimated,
    dayText: sprintDayText(sprint, today),
    items: contextItems,
    outside: contextItems
      .filter((entry) => entry.outside && deliverableId !== null)
      .map((entry) => entry.item),
  }
}
