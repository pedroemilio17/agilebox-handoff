import { describe, expect, it } from 'vitest'
import {
  createRecommendationState,
  featureRows,
  recommendationResult,
  toggleFeature,
} from './recommendation-state'
import { DEFAULT_WIZARD_DRAFT, type WizardDraft } from './wizard-steps'

const CICLOS_INTERNO: WizardDraft = {
  deliveryMode: 'ciclos',
  externalVisibility: 'nao',
  experience: 'Intermediário',
}

const CICLOS_EXTERNO: WizardDraft = {
  deliveryMode: 'ciclos',
  externalVisibility: 'sim',
  experience: 'Iniciante',
}

const CRONOGRAMA_EXPERIENTE: WizardDraft = {
  deliveryMode: 'cronograma',
  externalVisibility: 'nao',
  experience: 'Experiente',
}

describe('createRecommendationState', () => {
  it('para fluxo contínuo iniciante: sugere Fluxo Contínuo com WIP e Atualização diária', () => {
    const state = createRecommendationState('Portal', DEFAULT_WIZARD_DRAFT)
    expect(state.preset).toBe('kanban')
    expect(state.presetBadge).toBe('Fluxo Contínuo')
    expect(state.guideLevel).toBe('never')
    expect(state.summary).toBe(
      'Apoio do Kan configurado para perfil Iniciante · uso interno da equipe.',
    )
    expect(state.modules).toEqual(expect.arrayContaining(['wip', 'checkins']))
    expect(state.modules).not.toContain('sprints')
    expect(state.modules).not.toContain('core')
  })

  it('para ciclos internos: sugere Ciclos Ágeis (Sprints) com Backlog, Sprints e DoD', () => {
    const state = createRecommendationState('App', CICLOS_INTERNO)
    expect(state.preset).toBe('agil')
    expect(state.presetBadge).toBe('Ciclos Ágeis (Sprints)')
    expect(state.guideLevel).toBe('sometimes')
    expect(state.modules).toEqual(
      expect.arrayContaining(['backlog', 'sprints', 'definitionOfDone', 'checkins']),
    )
  })

  it('para ciclos com externos: sugere Ciclos + Marcos com Cliente e ativa Entregas e Cronograma', () => {
    const state = createRecommendationState('App', CICLOS_EXTERNO)
    expect(state.preset).toBe('hibrido')
    expect(state.presetBadge).toBe('Ciclos + Marcos com Cliente')
    expect(state.summary).toBe(
      'Apoio do Kan configurado para perfil Iniciante · com visibilidade para clientes e parceiros.',
    )
    expect(state.modules).toEqual(
      expect.arrayContaining(['backlog', 'sprints', 'wbs', 'risks', 'schedule', 'milestones']),
    )
  })

  it('para cronograma experiente: desliga Atualização diária e sugere Fases com Cronograma', () => {
    const state = createRecommendationState('Migração', CRONOGRAMA_EXPERIENTE)
    expect(state.preset).toBe('tradicional')
    expect(state.presetBadge).toBe('Fases com Cronograma')
    expect(state.guideLevel).toBe('always')
    expect(state.modules).not.toContain('checkins')
    expect(state.modules).toEqual(
      expect.arrayContaining(['definitionOfDone', 'wbs', 'risks', 'schedule', 'milestones']),
    )
  })
})

describe('toggleFeature e featureRows', () => {
  it('mantém Quadro nos 5 estados sempre ligado e travado', () => {
    const state = createRecommendationState('Portal', DEFAULT_WIZARD_DRAFT)
    const rows = featureRows(state)
    expect(rows).toHaveLength(8)
    expect(rows[0]).toMatchObject({ key: 'quadro', locked: true, on: true })
    expect(toggleFeature(state, 'quadro', false)).toBe(state)
  })

  it('desligar Backlog desliga Sprints em cascata e avisa', () => {
    const base = createRecommendationState('App', CICLOS_INTERNO)
    const next = toggleFeature(base, 'backlog', false)
    expect(next.modules).not.toContain('backlog')
    expect(next.modules).not.toContain('sprints')
    expect(next.notice).toContain('Desligar Backlog também desliga Sprints')
  })

  it('ligar Sprints sozinho puxa Backlog junto e avisa', () => {
    const base = createRecommendationState('Portal', DEFAULT_WIZARD_DRAFT)
    const next = toggleFeature(base, 'sprints', true)
    expect(next.modules).toEqual(expect.arrayContaining(['backlog', 'sprints']))
    expect(next.notice).toBe('Sprints (Ciclos curtos) precisa de Backlog. Ligado junto.')
  })

  it('recommendationResult entrega módulos sem núcleo, preset, guideLevel e answers', () => {
    const state = createRecommendationState('App', CICLOS_INTERNO)
    const result = recommendationResult(state)
    expect(result.modules).not.toContain('core')
    expect(result.startedFromPreset).toBe('agil')
    expect(result.guideLevel).toBe('sometimes')
    expect(result.answers).toEqual({
      workType: 'finite',
      fixedDate: 'no',
      scope: 'will_change',
      outsiderFollows: 'no',
      experience: 'sometimes',
    })
  })
})
