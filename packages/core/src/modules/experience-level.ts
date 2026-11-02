export const EXPERIENCE_LEVELS = ['basic', 'intermediate', 'advanced'] as const

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

/** Ordem crescente: `basic` < `intermediate` < `advanced`. */
export function isAtLeastLevel(level: ExperienceLevel, minimum: ExperienceLevel): boolean {
  return EXPERIENCE_LEVELS.indexOf(level) >= EXPERIENCE_LEVELS.indexOf(minimum)
}
