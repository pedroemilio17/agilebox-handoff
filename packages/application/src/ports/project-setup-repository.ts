import { ValidationError } from '@agilebox/core'
import type { OrganizationId, ProjectId, ProjectPresetKey, WizardAnswers } from '@agilebox/core'

/** Nível de guia escolhido no assistente (ADR-10). */
export type GuideLevel = 'never' | 'sometimes' | 'always'

/**
 * Configuração inicial do projeto (ADR-10): respostas do assistente, preset recomendado, preset de
 * partida e nível de guia. Nulo quando o assistente não foi usado naquele campo.
 */
export interface ProjectSetup {
  readonly projectId: ProjectId
  readonly answers: WizardAnswers | null
  readonly recommendedPreset: ProjectPresetKey | null
  readonly startedFromPreset: ProjectPresetKey | null
  readonly guideLevel: GuideLevel | null
}

/**
 * Configuração inicial de cada projeto. Uma linha por projeto (upsert por `projectId`). Toda leitura
 * e gravação recebe a organização e só toca nas linhas dela.
 */
export interface ProjectSetupRepository {
  /** Configuração do projeto, ou nulo quando ele não passou pelo assistente (ou é de outra organização). */
  get(organizationId: OrganizationId, projectId: ProjectId): Promise<ProjectSetup | null>
  /**
   * Grava a configuração (upsert por projeto). Projeto de outra organização (ou inexistente) e
   * `answers` que não seja objeto JSON simples são recusados com `ValidationError`, sem gravar nada.
   */
  save(organizationId: OrganizationId, setup: ProjectSetup): Promise<void>
}

/**
 * Regra de gravação compartilhada pelos repositórios: `answers` precisa ser objeto JSON simples
 * (não lista, não nulo, não instância de classe). O domínio já entrega o tipo; aqui só se protege
 * a coluna JSON de valor que não seja objeto.
 */
export function assertPlainAnswers(answers: unknown): void {
  if (answers === null) return
  const isPlainObject =
    typeof answers === 'object' &&
    !Array.isArray(answers) &&
    Object.getPrototypeOf(answers) === Object.prototype
  if (!isPlainObject) throw new ValidationError('Respostas do assistente devem ser um objeto')
}
