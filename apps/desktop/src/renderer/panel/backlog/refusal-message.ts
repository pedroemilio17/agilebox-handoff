import { ApiError } from '@agilebox/contract'

/**
 * Texto para uma recusa do servidor: a mensagem do domínio já vem em pt-BR (ex.: "Tarefa em
 * Desenvolvendo já começou"). Falha que não é recusa cai no texto padrão da tela.
 */
export function refusalMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message.trim() !== '') return error.message
  return fallback
}
