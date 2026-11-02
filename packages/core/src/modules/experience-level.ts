export const EXPERIENCE_LEVELS = ['basic', 'intermediate', 'advanced'] as const

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

/** Confere se o valor é um dos níveis do catálogo (usado antes de gravar o nível do time). */
export function isExperienceLevel(value: string): value is ExperienceLevel {
  return (EXPERIENCE_LEVELS as readonly string[]).includes(value)
}

/** Ordem crescente: `basic` < `intermediate` < `advanced`. */
export function isAtLeastLevel(level: ExperienceLevel, minimum: ExperienceLevel): boolean {
  return EXPERIENCE_LEVELS.indexOf(level) >= EXPERIENCE_LEVELS.indexOf(minimum)
}
