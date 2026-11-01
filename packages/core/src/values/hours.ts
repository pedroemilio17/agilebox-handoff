import { parseHundredths, validateHundredths } from './decimal'

export function parseHours(value: string): number {
  return parseHundredths(value)
}

export function formatHours(hundredths: number): string {
  validateHundredths(hundredths)
  const fraction = String(hundredths % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return `${Math.floor(hundredths / 100)}${fraction ? `,${fraction}` : ''} h`
}
