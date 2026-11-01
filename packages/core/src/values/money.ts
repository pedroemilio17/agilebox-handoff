import { parseHundredths, validateHundredths } from './decimal'

export function parseMoney(value: string): number {
  return parseHundredths(value.trim().replace(/^R\$\s*/, ''))
}

export function formatBRL(cents: number): string {
  validateHundredths(cents)
  const whole = Math.floor(cents / 100).toLocaleString('pt-BR')
  return `R$\u00a0${whole},${String(cents % 100).padStart(2, '0')}`
}

export function sumMoney(...values: number[]): number {
  let total = 0
  for (const value of values) {
    validateHundredths(value)
    total += value
    validateHundredths(total)
  }
  return total
}
