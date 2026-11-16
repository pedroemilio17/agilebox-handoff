/** Nível de proficiência da pessoa, do mais simples ao mais avançado. */
export type ExperienceLevel = 'basic' | 'intermediate' | 'advanced'

/** Níveis em ordem crescente. A posição define a comparação em `isLevelAtLeast`. */
export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = ['basic', 'intermediate', 'advanced']

export const EXPERIENCE_LEVEL_LABELS: Readonly<Record<ExperienceLevel, string>> = {
  basic: 'Básico',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
}

export function isLevelAtLeast(level: ExperienceLevel, minLevel: ExperienceLevel): boolean {
  return EXPERIENCE_LEVELS.indexOf(level) >= EXPERIENCE_LEVELS.indexOf(minLevel)
}
