/** Mesmos limites do contrato (`RETRO_ACTION_TITLE_MAX_LENGTH` e o limite de 30 por ocorrência). */
export const RETRO_ACTION_TITLE_MAX_LENGTH = 200
export const RETRO_ACTIONS_MAX = 30

export const RETRO_ACTION_MESSAGES = {
  titleRequired: 'Escreva o combinado.',
  titleTooLong: 'O combinado pode ter até 200 caracteres.',
  dueBeforeRetro: 'O prazo não pode ser antes da retro.',
} as const

/** Título obrigatório e até 200 caracteres (sem espaços das pontas). */
export function validateRetroActionTitle(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return RETRO_ACTION_MESSAGES.titleRequired
  if (Array.from(trimmed).length > RETRO_ACTION_TITLE_MAX_LENGTH)
    return RETRO_ACTION_MESSAGES.titleTooLong
  return null
}

/** Prazo opcional (vazio é válido) e nunca antes da data da ocorrência da retro. */
export function validateRetroActionDue(dueDate: string, occurrenceDate: string): string | null {
  if (dueDate !== '' && dueDate < occurrenceDate) return RETRO_ACTION_MESSAGES.dueBeforeRetro
  return null
}

/** Vencido: tem prazo, o prazo já passou e o combinado não foi feito. */
export const isRetroActionOverdue = (
  action: { readonly dueDate: string | null; readonly done: boolean },
  today: string,
): boolean => action.dueDate !== null && !action.done && action.dueDate < today
