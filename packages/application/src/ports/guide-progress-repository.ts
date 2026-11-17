import type { OrganizationId, ProjectId, UserId } from '@agilebox/core'

/**
 * Chave reservada do cartão "Primeiros passos" dispensado (ADR-10). Não é um passo da trilha: a
 * linha existe só para guardar a dispensa da pessoa naquele projeto.
 */
export const GUIDE_CARD_KEY = '__card__'

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
   * a regravação não muda a conclusão. Projeto, pessoa ou ator de outra organização (ou
   * inexistente) são recusados com `ValidationError`, sem gravar nada.
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
}
