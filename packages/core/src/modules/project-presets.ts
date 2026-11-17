import { ValidationError } from '../shared/errors'
import type { ModuleId } from './registry'
import { resolveModuleSet } from './resolve'

/**
 * Presets por projeto (ADR-10). Um preset é só uma lista de módulos para começar: metodologia é
 * dado, nunca código (regra 3). Depois da criação o projeto guarda apenas os módulos ligados, e o
 * nome do preset fica como "começou como". Os presets de equipe antigos (`presets.ts`) seguem
 * existindo até a migração de `team_modules` para o projeto.
 */
export const PROJECT_PRESET_KEYS = ['simples', 'kanban', 'agil', 'tradicional', 'hibrido'] as const
export type ProjectPresetKey = (typeof PROJECT_PRESET_KEYS)[number]

export interface ProjectPreset {
  readonly key: ProjectPresetKey
  readonly label: string
  /** Para quê, em uma frase. */
  readonly purpose: string
  /** Módulos ligados, sem o núcleo (sempre ligado) e sem o que eles exigem (o resolvedor acrescenta). */
  readonly modules: readonly ModuleId[]
  /** Acrescentados quando a equipe é experiente. Só aqui entram módulos de nível 3. */
  readonly experiencedExtras: readonly ModuleId[]
}

export const PROJECT_PRESETS: readonly ProjectPreset[] = Object.freeze(
  (
    [
      {
        key: 'simples',
        label: 'Simples',
        purpose: 'Quem não quer decidir agora',
        modules: [],
        experiencedExtras: ['checkins'],
      },
      {
        key: 'kanban',
        label: 'Kanban',
        purpose: 'Trabalho contínuo',
        modules: ['wip', 'definitionOfDone', 'checkins'],
        experiencedExtras: ['flowMetrics'],
      },
      {
        key: 'agil',
        label: 'Ágil (Scrum)',
        purpose: 'Escopo que muda',
        modules: ['backlog', 'estimates.hours', 'sprints', 'reviewRetro', 'checkins'],
        experiencedExtras: ['definitionOfDone', 'burndown'],
      },
      {
        key: 'tradicional',
        label: 'Tradicional',
        purpose: 'Prazo e escopo fixos',
        modules: ['wbs', 'milestones', 'schedule', 'estimates.hours'],
        experiencedExtras: ['cost', 'baseline', 'risks'],
      },
      {
        key: 'hibrido',
        label: 'Híbrido',
        purpose: 'Prazo fixo com detalhes que mudam',
        modules: ['wbs', 'milestones', 'backlog', 'estimates.hours', 'sprints'],
        experiencedExtras: ['schedule', 'burndown'],
      },
    ] satisfies readonly ProjectPreset[]
  ).map((preset) =>
    Object.freeze({
      ...preset,
      modules: Object.freeze([...preset.modules]),
      experiencedExtras: Object.freeze([...preset.experiencedExtras]),
    }),
  ),
)

export function getProjectPreset(key: ProjectPresetKey): ProjectPreset {
  const preset = PROJECT_PRESETS.find((candidate) => candidate.key === key)
  if (!preset) throw new ValidationError('Preset de projeto desconhecido')
  return preset
}

/**
 * Módulos ligados quando o projeto nasce no preset, já com as dependências puxadas (em ordem do
 * catálogo, sempre com `core`). `experienced` acrescenta a coluna "equipe experiente".
 * Nível 3 só entra pelos extras; nível 2 entra em qualquer caso (ADR-10, "Regras dos presets").
 */
export function projectPresetModules(
  key: ProjectPresetKey,
  options: { readonly experienced: boolean },
): ModuleId[] {
  const preset = getProjectPreset(key)
  const enable = options.experienced
    ? [...preset.modules, ...preset.experiencedExtras]
    : [...preset.modules]
  const resolution = resolveModuleSet([], { enable })
  if (!resolution.ok) throw new ValidationError('Preset de projeto inválido')
  return resolution.enabled
}
