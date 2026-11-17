import { MILESTONE_CRITERION_INPUT_MAX, MILESTONE_TITLE_INPUT_MAX } from '@agilebox/contract'

/**
 * Regras puras da tela Marcos: datas por extenso, dias restantes e validação do formulário. Datas
 * são `AAAA-MM-DD` (sem hora); as contas usam UTC para não mudar de dia com o fuso.
 */

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
const DAY_MS = 86_400_000

function utcDay(dateOnly: string): number {
  const [year = 0, month = 1, day = 1] = dateOnly.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

/** Data curta para a lista: "qui 18/12". */
export function shortDateLabel(dueOn: string): string {
  const day = new Date(utcDay(dueOn))
  const weekday = WEEKDAYS[day.getUTCDay()]
  const dd = String(day.getUTCDate()).padStart(2, '0')
  const mm = String(day.getUTCMonth() + 1).padStart(2, '0')
  return `${weekday} ${dd}/${mm}`
}

/** Dias de `today` até `dueOn` (negativo se já passou). */
export function daysUntil(dueOn: string, today: string): number {
  return Math.round((utcDay(dueOn) - utcDay(today)) / DAY_MS)
}

/** Texto dos dias restantes: só para marco de hoje ou futuro; passado não mostra nada. */
export function daysLeftText(dueOn: string, today: string): string | null {
  const days = daysUntil(dueOn, today)
  if (days < 0) return null
  if (days === 0) return 'hoje'
  if (days === 1) return 'falta 1 dia'
  return `faltam ${days} dias`
}

/** Entrega no seletor e na lista: "2.2 · Módulo financeiro". */
export function deliverableLabel(code: string, title: string): string {
  return `${code} · ${title}`
}

export interface MilestoneFormValues {
  readonly title: string
  readonly dueOn: string
  readonly criterion: string
}

export interface MilestoneFormErrors {
  readonly title?: string
  readonly dueOn?: string
  readonly criterion?: string
}

export const milestoneCopy = {
  titleRequired: 'Dê um título ao marco.',
  titleTooLong: `O título pode ter até ${MILESTONE_TITLE_INPUT_MAX} caracteres.`,
  dateRequired: 'Escolha a data do marco.',
  criterionTooLong: `O critério pode ter até ${MILESTONE_CRITERION_INPUT_MAX} caracteres.`,
} as const

/** Validação do formulário antes de enviar. O servidor confere de novo e a recusa aparece na tela. */
export function validateMilestoneForm(values: MilestoneFormValues): MilestoneFormErrors {
  const errors: { title?: string; dueOn?: string; criterion?: string } = {}
  const title = values.title.trim()
  if (title === '') errors.title = milestoneCopy.titleRequired
  else if (title.length > MILESTONE_TITLE_INPUT_MAX) errors.title = milestoneCopy.titleTooLong
  if (values.dueOn === '') errors.dueOn = milestoneCopy.dateRequired
  if (values.criterion.trim().length > MILESTONE_CRITERION_INPUT_MAX)
    errors.criterion = milestoneCopy.criterionTooLong
  return errors
}

/** Campo de texto vazio vira nulo no envio (critério e entrega opcionais). */
export function criterionOrNull(criterion: string): string | null {
  const trimmed = criterion.trim()
  return trimmed === '' ? null : trimmed
}
