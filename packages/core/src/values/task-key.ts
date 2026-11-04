import { ValidationError } from '../shared/errors'

export interface TaskKey {
  readonly prefix: string
  readonly number: number
}

const PREFIX_PATTERN = /^[A-Z]{2,5}$/u
const KEY_PATTERN = /^([A-Z]{2,5})-([1-9]\d*)$/u

export const DEFAULT_TASK_PREFIX = 'AB'

export function isTaskPrefix(value: string): boolean {
  return PREFIX_PATTERN.test(value)
}

export function parseTaskPrefix(value: string): string {
  if (!isTaskPrefix(value)) throw new ValidationError('Prefixo de tarefa inválido')
  return value
}

export function isTaskNumber(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

export function parseTaskNumber(value: number): number {
  if (!isTaskNumber(value)) throw new ValidationError('Número da tarefa inválido')
  return value
}

export function formatTaskKey(prefix: string, number: number): string {
  return `${parseTaskPrefix(prefix)}-${parseTaskNumber(number)}`
}

export function parseTaskKey(value: string): TaskKey | null {
  const match = KEY_PATTERN.exec(value)
  if (!match) return null
  const number = Number(match[2])
  if (!isTaskNumber(number)) return null
  return { prefix: match[1]!, number }
}
