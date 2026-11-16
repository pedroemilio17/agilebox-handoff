import type { ExperienceLevel } from './levels'
import type { ModuleId } from './registry'

export type TeamPresetId = 'kanban' | 'scrum' | 'kanban-flow' | 'scrum-complete'

export interface TeamPreset {
  id: TeamPresetId
  label: string
  /** Ferramentas pré-selecionadas. A equipe pode ajustar depois. */
  modules: readonly ModuleId[]
  suggestedLevel: ExperienceLevel
}

const KANBAN_MODULES: readonly ModuleId[] = ['core', 'agenda']

const SCRUM_MODULES: readonly ModuleId[] = [
  ...KANBAN_MODULES,
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'acceptance',
]

const SCRUM_COMPLETE_MODULES: readonly ModuleId[] = [...SCRUM_MODULES, 'reviewRetro', 'burndown']

/** Presets só pré-selecionam ferramentas; as regras de dependência e conflito continuam valendo. */
export const TEAM_PRESETS: readonly TeamPreset[] = Object.freeze([
  {
    id: 'kanban',
    label: 'Kanban simples',
    modules: [...KANBAN_MODULES],
    suggestedLevel: 'basic',
  },
  {
    id: 'scrum',
    label: 'Scrum',
    modules: [...SCRUM_MODULES],
    suggestedLevel: 'intermediate',
  },
  {
    id: 'kanban-flow',
    label: 'Kanban com fluxo',
    modules: [...KANBAN_MODULES, 'wip', 'subtasks', 'flowMetrics'],
    suggestedLevel: 'advanced',
  },
  {
    id: 'scrum-complete',
    label: 'Scrum completo',
    modules: [...SCRUM_COMPLETE_MODULES],
    suggestedLevel: 'advanced',
  },
])
