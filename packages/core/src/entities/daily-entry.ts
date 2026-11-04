import { ValidationError } from '../shared/errors'
import type { DailyEntryId, OrganizationId, TaskId, UserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

/** Tamanho máximo de cada resposta da daily, em caracteres. */
export const DAILY_ANSWER_MAX_LENGTH = 500

/** Respostas da daily, na ordem dos passos da bandeja. */
export interface DailyAnswers {
  /** Passo 1, "O que você avançou hoje?": texto livre do que não passou pelo quadro. */
  readonly progress: string
  /** Passo 2, "Próximo passo". */
  readonly nextStep: string
  /** Passo 3, "Algo te bloqueia?". */
  readonly blocker: string
}

/**
 * Daily de uma pessoa em um dia (data local, `YYYY-MM-DD`). Há no máximo uma por pessoa e dia.
 * `taskRefs` são tarefas citadas (só as de que a própria pessoa participa); citar não altera a tarefa.
 * Entidades nunca têm daily: o titular é sempre um usuário.
 */
export interface DailyEntry {
  readonly id: DailyEntryId
  readonly organizationId: OrganizationId
  readonly userId: UserId
  readonly date: DateOnly
  readonly answers: DailyAnswers
  /** "Sem novidades": a daily vale mesmo sem respostas. */
  readonly noNews: boolean
  readonly taskRefs: readonly TaskId[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface DailyEntryDraft {
  readonly id: DailyEntryId
  readonly organizationId: OrganizationId
  readonly userId: UserId
  readonly date: string
  readonly answers: DailyAnswers
  readonly noNews: boolean
  readonly taskRefs: readonly TaskId[]
  readonly createdAt: string
  readonly updatedAt: string
}

function validateAnswer(label: string, value: string): string {
  const trimmed = value.trim()
  if (Array.from(trimmed).length > DAILY_ANSWER_MAX_LENGTH)
    throw new ValidationError(`${label} deve ter até ${DAILY_ANSWER_MAX_LENGTH} caracteres`)
  return trimmed
}

/**
 * Valida e normaliza uma daily. Respostas recebem trim. taskRefs repetidos são descartados.
 * Sem "sem novidades", pelo menos uma das três respostas precisa estar preenchida.
 */
export function createDailyEntry(draft: DailyEntryDraft): DailyEntry {
  const date = parseDateOnly(draft.date)
  const answers: DailyAnswers = {
    progress: validateAnswer('Avanços de hoje', draft.answers.progress),
    nextStep: validateAnswer('Próximo passo', draft.answers.nextStep),
    blocker: validateAnswer('Bloqueio', draft.answers.blocker),
  }
  const hasText = [answers.progress, answers.nextStep, answers.blocker].some(
    (answer) => answer.length > 0,
  )
  if (!draft.noNews && !hasText)
    throw new ValidationError('Preencha pelo menos uma resposta ou marque "Sem novidades"')
  return {
    ...draft,
    date,
    answers,
    taskRefs: [...new Set(draft.taskRefs)],
  }
}
