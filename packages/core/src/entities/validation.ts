import { ValidationError } from '../shared/errors'
import { validateHundredths } from '../values/decimal'

export function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('Nome obrigatório')
  return trimmed
}

export function validateDefaultRate(rate: number): void {
  validateHundredths(rate)
  if (rate === 0) throw new ValidationError('Valor/hora padrão deve ser maior que zero')
}
