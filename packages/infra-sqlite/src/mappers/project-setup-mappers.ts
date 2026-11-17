import { PROJECT_PRESET_KEYS, toProjectId, ValidationError } from '@agilebox/core'
import type { ProjectPresetKey, WizardAnswers } from '@agilebox/core'
import type { GuideLevel, ProjectSetup } from '@agilebox/application'
import type { projectSetup } from '../schema/index.js'

type ProjectSetupRow = typeof projectSetup.$inferSelect

const GUIDE_LEVELS: readonly GuideLevel[] = ['never', 'sometimes', 'always']

function presetOrNull(value: string | null): ProjectPresetKey | null {
  if (value === null) return null
  if (!(PROJECT_PRESET_KEYS as readonly string[]).includes(value))
    throw new ValidationError('Preset de projeto gravado no banco é desconhecido')
  return value as ProjectPresetKey
}

function guideLevelOrNull(value: string | null): GuideLevel | null {
  if (value === null) return null
  if (!(GUIDE_LEVELS as readonly string[]).includes(value))
    throw new ValidationError('Nível de guia gravado no banco é desconhecido')
  return value as GuideLevel
}

/** `answers` é JSON de objeto simples, validado na gravação; aqui só se desserializa. */
export function mapProjectSetupRow(row: ProjectSetupRow): ProjectSetup {
  return {
    projectId: toProjectId(row.projectId),
    answers: row.answers === null ? null : (JSON.parse(row.answers) as WizardAnswers),
    recommendedPreset: presetOrNull(row.recommendedPreset),
    startedFromPreset: presetOrNull(row.startedFromPreset),
    guideLevel: guideLevelOrNull(row.guideLevel),
  }
}
