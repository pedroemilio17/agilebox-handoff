import { ValidationError } from '../shared/errors'

export interface Ticket {
  readonly id: number
  readonly url?: string
}

export function createTicket(id: number, url?: string): Ticket {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ValidationError('ID do chamado inválido')
  }

  if (url !== undefined) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new ValidationError('Link do chamado inválido')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ValidationError('Link do chamado inválido')
    }
    return { id, url }
  }

  return { id }
}
