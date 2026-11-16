import { ValidationError } from '@agilebox/core'
import type { ModuleId, TeamModuleConfig } from '@agilebox/core'

/** Um campo configurável de um módulo: inteiro dentro de uma faixa, com padrão. */
interface IntegerField {
  readonly kind: 'integer'
  readonly min: number
  readonly max: number
  readonly message: string
}

/**
 * Módulos com configuração (TeamModuleSetting.config). Módulo fora desta lista não aceita config.
 * A faixa de `maxActiveSprints` é a decisão de ADR-08 (1 a 5, padrão 1 em `readSprintsMaxActive`).
 */
const CONFIGURABLE: Partial<Record<ModuleId, Record<string, IntegerField>>> = {
  sprints: {
    maxActiveSprints: {
      kind: 'integer',
      min: 1,
      max: 5,
      message: 'Limite de sprints ativas deve ser um número inteiro de 1 a 5',
    },
  },
}

/**
 * Valida a configuração de um módulo antes da gravação: o módulo precisa ter chave configurável, e
 * cada chave precisa existir no módulo e ter valor válido. Objeto vazio volta ao padrão.
 */
export function validateModuleConfig(
  moduleId: ModuleId,
  config: Readonly<Record<string, unknown>>,
): TeamModuleConfig {
  const fields = CONFIGURABLE[moduleId]
  if (!fields) throw new ValidationError('Esta ferramenta não tem configuração')
  const valid: Record<string, number> = {}
  for (const [key, value] of Object.entries(config)) {
    const field = fields[key]
    if (!field) throw new ValidationError(`Configuração desconhecida: ${key}`)
    if (
      !Number.isSafeInteger(value) ||
      (value as number) < field.min ||
      (value as number) > field.max
    )
      throw new ValidationError(field.message)
    valid[key] = value as number
  }
  return valid
}

/** Módulos que têm configuração, para a tela e os testes. */
export function configurableModuleIds(): readonly ModuleId[] {
  return Object.keys(CONFIGURABLE) as ModuleId[]
}
