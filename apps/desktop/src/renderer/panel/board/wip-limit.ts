import { WIP_LIMIT_MAX, WIP_LIMIT_MIN, type WipColumnDto } from '@agilebox/contract'

/** Colunas que aceitam limite de WIP nesta fase. */
export type WipStatus = WipColumnDto['status']

export const WIP_STATUSES: readonly WipStatus[] = ['in_progress', 'review']

export function isWipStatus(status: string): status is WipStatus {
  return (WIP_STATUSES as readonly string[]).includes(status)
}

/** Lê o campo do limite: só inteiros de 1 a 99. Devolve null quando inválido. */
export function parseWipLimitInput(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value >= WIP_LIMIT_MIN && value <= WIP_LIMIT_MAX ? value : null
}
