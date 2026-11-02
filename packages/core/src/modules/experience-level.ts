export const EXPERIENCE_LEVELS = ['basic', 'intermediate', 'advanced'] as const

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]
