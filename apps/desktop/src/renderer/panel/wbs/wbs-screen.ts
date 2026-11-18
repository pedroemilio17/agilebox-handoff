import {
  formatBRL,
  formatHours as formatHundredthsHours,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from '@agilebox/core'
import { ApiError, WBS_MAX_LEVEL, type WbsRowDto, type WbsViewDto } from '@agilebox/contract'

/**
 * Regras de exibição da tela "Entregas" (EAP). Funções puras: não falam com a API nem com a tela.
 * O servidor valida tudo que grava (níveis, posições, remoção); aqui só se decide o que aparece e
 * que posição pedir ao mover.
 */

export type WbsDeliverableRow = Extract<WbsRowDto, { kind: 'deliverable' }>
export type WbsTaskRow = Extract<WbsRowDto, { kind: 'task' }>

/** Id da entrega que contém a linha: a própria entrega-pai, ou a entrega da tarefa. */
export function parentIdOf(row: WbsRowDto): string | null {
  return row.kind === 'deliverable' ? row.parentId : row.deliverableId
}

/** Linhas que aparecem: some tudo o que tem um ancestral recolhido. A ordem de exibição é mantida. */
export function visibleRows(
  rows: readonly WbsRowDto[],
  collapsed: ReadonlySet<string>,
): readonly WbsRowDto[] {
  if (collapsed.size === 0) return rows
  const parents = new Map<string, string | null>()
  for (const row of rows) {
    if (row.kind === 'deliverable') parents.set(row.id, row.parentId)
  }
  const hiddenBy = (row: WbsRowDto): boolean => {
    let parent = parentIdOf(row)
    // Limite de segurança: a EAP tem no máximo WBS_MAX_LEVEL níveis, então o laço é curto.
    for (let depth = 0; parent !== null && depth <= WBS_MAX_LEVEL; depth += 1) {
      if (collapsed.has(parent)) return true
      parent = parents.get(parent) ?? null
    }
    return false
  }
  return rows.filter((row) => !hiddenBy(row))
}

/** Entregas que têm filhos (subentregas ou tarefas): só essas têm botão de recolher. */
export function expandableIds(rows: readonly WbsRowDto[]): readonly string[] {
  const parents = new Set<string>()
  for (const row of rows) {
    const parent = parentIdOf(row)
    if (parent !== null) parents.add(parent)
  }
  return rows
    .filter((row): row is WbsDeliverableRow => row.kind === 'deliverable' && parents.has(row.id))
    .map((row) => row.id)
}

/** "Recolher tudo": todas as entregas com filhos. "Expandir tudo" é o conjunto vazio. */
export function collapseAll(rows: readonly WbsRowDto[]): ReadonlySet<string> {
  return new Set(expandableIds(rows))
}

/** Subentrega só existe abaixo do nível 3 (o servidor também valida). */
export function canHaveSubdeliverable(level: number): boolean {
  return level < WBS_MAX_LEVEL
}

/** Horas no formato do core: "40 h", "12,5 h". Sem valor: "—". */
export function formatHours(hours: number | null): string {
  if (hours === null) return '—'
  return formatHundredthsHours(Math.round(hours * 100))
}

/** Custo em reais. Vem nulo para quem não é gestor: aparece "—". */
export function formatCost(cost: number | null): string {
  if (cost === null) return '—'
  return formatBRL(Math.round(cost * 100))
}

export type ProgressTone = 'idle' | 'started' | 'done'

/** 100% é concluído; acima de zero, em andamento; zero, parado. */
export function progressTone(progress: number): ProgressTone {
  if (progress >= 100) return 'done'
  return progress > 0 ? 'started' : 'idle'
}

/** Contagem do resumo: "4 · 10 tarefas". */
export function summaryCountText(deliverables: number, tasks: number): string {
  return `${deliverables} · ${tasks} ${tasks === 1 ? 'tarefa' : 'tarefas'}`
}

export function taskStatusText(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status]
}

/** Iniciais de um nome para o círculo de responsável. Sem nome: "—". */
export function initialsOf(name: string | null): string {
  if (name === null) return '—'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '—'
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export type MoveDirection = 'up' | 'down'

/** Irmãos de uma entrega (mesmo pai), na ordem de exibição. */
function siblingsOf(rows: readonly WbsRowDto[], deliverable: WbsDeliverableRow) {
  return rows.filter(
    (row): row is WbsDeliverableRow =>
      row.kind === 'deliverable' && row.parentId === deliverable.parentId,
  )
}

/**
 * Posição para "Subir" ou "Descer" dentro dos irmãos. O servidor tira a entrega da lista e a põe na
 * posição pedida, então subir é ir uma posição antes e descer, uma depois. Nas pontas, `null`.
 */
export function siblingMove(
  rows: readonly WbsRowDto[],
  deliverableId: string,
  direction: MoveDirection,
): { readonly parentId: string | null; readonly position: number } | null {
  const deliverable = rows.find(
    (row): row is WbsDeliverableRow => row.kind === 'deliverable' && row.id === deliverableId,
  )
  if (!deliverable) return null
  const siblings = siblingsOf(rows, deliverable)
  const index = siblings.findIndex((row) => row.id === deliverableId)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= siblings.length) return null
  return { parentId: deliverable.parentId, position: target }
}

/** Nenhuma entrega na EAP: vale o estado vazio que ensina a criar a primeira. */
export function isWbsEmpty(view: Pick<WbsViewDto, 'deliverables'>): boolean {
  return !view.deliverables.some((row) => row.kind === 'deliverable')
}

/** Rótulo do campo numerado do passo 1: "Entrega 1", "Entrega 2"... pela posição do campo. */
export function guidedFieldLabel(index: number): string {
  return `Entrega ${index + 1}`
}

/** Próximo campo depois do que acabou de criar uma entrega, ou `null` no último campo. */
export function nextFieldIndex(current: number, fieldCount: number): number | null {
  return current + 1 < fieldCount ? current + 1 : null
}

/** Todas as entregas com filhos estão recolhidas (e há alguma). */
export function allCollapsed(rows: readonly WbsRowDto[], collapsed: ReadonlySet<string>): boolean {
  const expandable = expandableIds(rows)
  return expandable.length > 0 && expandable.every((id) => collapsed.has(id))
}

/** Texto do botão de recolher tudo: "Expandir tudo" quando tudo já está recolhido. */
export function collapseToggleLabel(
  rows: readonly WbsRowDto[],
  collapsed: ReadonlySet<string>,
): string {
  return allCollapsed(rows, collapsed) ? 'Expandir tudo' : 'Recolher tudo'
}

/** Mensagem de erro de uma ação da EAP: a do servidor quando há, senão um aviso genérico. */
export function actionErrorText(error: unknown): string {
  if (error instanceof ApiError && error.message.trim() !== '') return error.message
  return 'Não foi possível salvar a alteração. Tente de novo.'
}

const DAY_MS = 86_400_000

function utcDayOf(dateOnly: string): number {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / DAY_MS
}

/**
 * Dias de atraso de uma tarefa sem concluir, com o prazo antes de hoje. Sem prazo, concluída ou no
 * prazo: `null`, e a linha não ganha o aviso.
 */
export function overdueDays(deadline: string | null, done: boolean, today: string): number | null {
  if (done || deadline === null) return null
  const days = utcDayOf(today) - utcDayOf(deadline)
  return days > 0 ? days : null
}

/** Aviso de atraso da tarefa: "7 dias atrás", ou "1 dia atrás". */
export function overdueText(days: number): string {
  return `${days} ${days === 1 ? 'dia' : 'dias'} atrás`
}

/** Dia e mês de uma data `AAAA-MM-DD`: "18/12". */
export function dayMonthText(dateOnly: string): string {
  const [, month, day] = dateOnly.split('-')
  return `${day}/${month}`
}
