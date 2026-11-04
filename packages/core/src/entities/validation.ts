import { ValidationError } from '../shared/errors'
import { validateHundredths } from '../values/decimal'
import { parseTaskNumber } from '../values/task-key'

export function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('Nome obrigatório')
  return trimmed
}

export const BLOCK_REASON_MAX_LENGTH = 280

export function validateBlockReason(reason: string): string {
  const trimmed = reason.trim()
  if (!trimmed) throw new ValidationError('Motivo do bloqueio obrigatório')
  if (Array.from(trimmed).length > BLOCK_REASON_MAX_LENGTH)
    throw new ValidationError('Motivo do bloqueio deve ter até 280 caracteres')
  return trimmed
}

export const CHECKLIST_TITLE_MAX_LENGTH = 200
export const CHECKLIST_MAX_ITEMS = 50

export function validateChecklistTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new ValidationError('Título da subtarefa obrigatório')
  if (Array.from(trimmed).length > CHECKLIST_TITLE_MAX_LENGTH)
    throw new ValidationError('Subtarefa deve ter até 200 caracteres')
  return trimmed
}

export const DEFINITION_OF_DONE_TITLE_MAX_LENGTH = 200

export function validateDefinitionOfDoneTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new ValidationError('Título do item da definição de pronto obrigatório')
  if (Array.from(trimmed).length > DEFINITION_OF_DONE_TITLE_MAX_LENGTH)
    throw new ValidationError('Item da definição de pronto deve ter até 200 caracteres')
  return trimmed
}

export function validateDefaultRate(rate: number): void {
  validateHundredths(rate)
}

export function validateTaskNumber(number: number): number {
  return parseTaskNumber(number)
}
