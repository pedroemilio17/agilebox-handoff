import { ValidationError } from '../shared/errors'

// Trabalha com dígitos para evitar erros de ponto flutuante no arredondamento.
export function parseHundredths(value: string): number {
  const match = /^(\d+)(?:[,.](\d+))?$/.exec(value.trim())
  if (!match) throw new ValidationError('Valor numérico inválido')
  const fraction = (match[2] ?? '').padEnd(3, '0')
  const rounded =
    BigInt(match[1]!) * 100n + BigInt(fraction.slice(0, 2)) + (fraction[2]! >= '5' ? 1n : 0n)
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER))
    throw new ValidationError('Valor numérico muito grande')
  return Number(rounded)
}

export function validateHundredths(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ValidationError('Valor numérico inválido')
}
