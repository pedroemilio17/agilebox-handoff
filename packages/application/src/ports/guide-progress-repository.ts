import type { OrganizationId, ProjectId, UserId } from '@agilebox/core'

/**
 * Chave reservada do cartão "Primeiros passos" dispensado (ADR-10). Não é um passo da trilha: a
 * linha existe só para guardar a dispensa da pessoa naquele projeto.
 */
export const GUIDE_CARD_KEY = '__card__'

/**
 * Chave reservada da janela de boas-vindas (ADR-10). A linha guarda que a pessoa já respondeu à
 * janela ("ver a trilha" ou "agora não"), com `dismissed = true`. Como a do cartão, não é passo.
 */
export const GUIDE_WELCOME_KEY = '__welcome__'

/** Chaves que a tabela guarda sem serem passos da trilha. Nunca contam como concluídas. */
export const GUIDE_RESERVED_KEYS: readonly string[] = [GUIDE_CARD_KEY, GUIDE_WELCOME_KEY]

/** Verdadeiro para as chaves reservadas (cartão, boas-vindas): não são passos do guia. */
export function isReservedGuideKey(stepKey: string): boolean {
  return GUIDE_RESERVED_KEYS.includes(stepKey)
}

/** Estado de um passo (ou da dispensa do cartão) para uma pessoa num projeto. */
export interface GuideProgressEntry {
  readonly stepKey: string
  /** Instante do primeiro conclusão. Nulo quando a linha só guarda a dispensa. */
  readonly doneAt: string | null
  readonly dismissed: boolean
}

/**
 * Progresso do guia por pessoa e projeto. Toda leitura e gravação recebe a organização e só toca
 * nas linhas dela. A chave é (projeto, pessoa, passo).
 */
export interface GuideProgressRepository {
  /** Linhas da pessoa no projeto. Sem linhas, lista vazia. */
  listForUser(
    organizationId: OrganizationId,
    projectId: ProjectId,
    userId: UserId,
  ): Promise<readonly GuideProgressEntry[]>
  /**
   * Marca os passos como concluídos (upsert). Passo que já tem `done_at` mantém o primeiro instante:
   * a regravação não muda a conclusão. Projeto ou pessoa de outra organização (ou inexistente) são
   * recusados com `ValidationError`, sem gravar nada. Chave reservada também é recusada.
   */
  markDone(
    organizationId: OrganizationId,
    projectId: ProjectId,
    userId: UserId,
    stepKeys: readonly string[],
    at: string,
  ): Promise<void>
  /** Grava a dispensa do cartão "Primeiros passos" (linha `GUIDE_CARD_KEY`, upsert). */
  dismissCard(
    organizationId: OrganizationId,
    projectId: ProjectId,
    userId: UserId,
    at: string,
  ): Promise<void>
  /**
   * Grava que a pessoa respondeu à janela de boas-vindas (linha `GUIDE_WELCOME_KEY`, upsert). Mesmo
   * cuidado da dispensa: projeto ou pessoa de outra organização são recusados com `ValidationError`.
   */
  resolveWelcome(
    organizationId: OrganizationId,
    projectId: ProjectId,
    userId: UserId,
    at: string,
  ): Promise<void>
}
