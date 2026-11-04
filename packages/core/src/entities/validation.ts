import { ValidationError } from '../shared/errors'
import { validateHundredths } from '../values/decimal'
import { parseTaskNumber } from '../values/task-key'

export function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('Nome obrigatório')
  return trimmed
}

export function validateDefaultRate(rate: number): void {
  validateHundredths(rate)
}

export function validateTaskNumber(number: number): number {
  return parseTaskNumber(number)
}
