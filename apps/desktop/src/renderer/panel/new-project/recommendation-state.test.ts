import { getManifest } from '@agilebox/core'
import type { WizardAnswers } from '@agilebox/core'
import { describe, expect, it } from 'vitest'
import {
  changeExperience,
  choosePreset,
  createRecommendationState,
  disableModule,
  enableModule,
  experienceQuestion,
  guideBullets,
  hiddenExtrasNote,
  presetTitleParts,
  moduleRows,
  recommendationResult,
} from './recommendation-state'

const AGIL_ANSWERS: WizardAnswers = {
  workType: 'finite',
  fixedDate: 'no',
  scope: 'will_change',
  controlsHoursAndCost: 'yes',
}

const names = (rows: { name: string }[]) => rows.map((row) => row.name)

describe('createRecommendationState', () => {
  it('começa no preset recomendado, com módulos, motivos e experiência never', () => {
    const state = createRecommendationState('App', AGIL_ANSWERS)

    expect(state.preset).toBe('agil')
    expect(state.recommendedPreset).toBe('agil')
    expect(state.guideLevel).toBe('never')
    expect(state.modules).toEqual(
      expect.arrayContaining(['backlog', 'sprints', 'estimates.hours', 'cost', 'reviewRetro']),
    )
    expect(state.modules).toContain('agenda')
    expect(state.modules).not.toContain('core')
    expect(state.reasons.backlog).toContain('Backlog ligado')
  })

  it('usa a experiência das respostas quando ela existe', () => {
    const state = createRecommendationState('App', { ...AGIL_ANSWERS, experience: 'sometimes' })
    expect(state.guideLevel).toBe('sometimes')
    expect(state.modules).toContain('burndown')
  })
})

describe('choosePreset', () => {
  it('troca para Tradicional com os extras das respostas e sem motivo da recomendação', () => {
    const state = choosePreset(createRecommendationState('App', AGIL_ANSWERS), 'tradicional')

    expect(state.preset).toBe('tradicional')
    expect(state.modules).toEqual(expect.arrayContaining(['wbs', 'milestones', 'schedule', 'cost']))
    expect(state.modules).not.toContain('sprints')
    expect(state.reasons).toEqual({})
    expect(moduleRows(state).on.find((row) => row.id === 'wbs')?.reason).toBe(
      getManifest('wbs').objective,
    )
  })

  it('volta ao recomendado e restaura a recomendação', () => {
    const base = createRecommendationState('App', AGIL_ANSWERS)
    const back = choosePreset(choosePreset(base, 'simples'), 'agil')
    expect(back.modules).toEqual(base.modules)
    expect(back.reasons).toEqual(base.reasons)
  })
})

describe('disableModule e enableModule', () => {
  it('desligar Backlog desliga Sprints junto e avisa', () => {
    const state = disableModule(createRecommendationState('App', AGIL_ANSWERS), 'backlog')

    expect(state.modules).not.toContain('backlog')
    expect(state.modules).not.toContain('sprints')
    expect(state.off).toEqual(expect.arrayContaining(['backlog', 'sprints']))
    expect(state.notice).toBe(
      'Desligar Backlog também desliga Sprints e Cerimônias, que dependem dele.',
    )
  })

  it('ligar Sprints sozinho puxa Backlog e avisa', () => {
    const off = disableModule(createRecommendationState('App', AGIL_ANSWERS), 'backlog')
    const state = enableModule(off, 'sprints')

    expect(state.modules).toEqual(expect.arrayContaining(['backlog', 'sprints']))
    expect(state.off).not.toContain('backlog')
    expect(state.notice).toBe('Sprints precisa de Backlog. Ligamos os dois.')
  })

  it('o núcleo nunca entra na lista nem é desligado', () => {
    const state = createRecommendationState('App', AGIL_ANSWERS)
    expect(disableModule(state, 'core')).toBe(state)
    expect(moduleRows(state).on.map((row) => row.id)).not.toContain('core')
  })

  it('ligar um módulo que já está ligado não muda nada', () => {
    const state = createRecommendationState('App', AGIL_ANSWERS)
    expect(enableModule(state, 'backlog')).toBe(state)
  })
})

describe('changeExperience', () => {
  it('troca os bullets conforme a experiência', () => {
    const state = createRecommendationState('App', AGIL_ANSWERS)
    expect(guideBullets(state.guideLevel)[0]).toBe('Primeiros passos abertos')

    const always = changeExperience(state, 'always')
    expect(guideBullets(always.guideLevel)[0]).toBe('Primeiros passos ocultos, abrem pelo ?')
    expect(guideBullets(always.guideLevel)[2]).toBe('Sem dicas de primeira vez')
  })

  it('com experiência, os extras entram na lista; sem ela, viram só a nota', () => {
    const state = createRecommendationState('App', AGIL_ANSWERS)
    expect(hiddenExtrasNote(state)).toBe(
      'Critério de pronto e Burndown e velocidade entram quando a equipe já trabalha com Scrum.',
    )

    const sometimes = changeExperience(state, 'sometimes')
    expect(sometimes.modules).toEqual(expect.arrayContaining(['definitionOfDone', 'burndown']))
    expect(hiddenExtrasNote(sometimes)).toBeNull()

    const never = changeExperience(sometimes, 'never')
    expect(never.modules).not.toContain('burndown')
    expect(never.off).not.toContain('burndown')
  })

  it('a pergunta 6 cita o preset', () => {
    expect(experienceQuestion('agil')).toBe('A equipe já trabalhou com Scrum?')
    expect(experienceQuestion('simples')).toBe('A equipe já organizou projetos assim?')
  })
})

describe('recommendationResult', () => {
  it('entrega módulos sem núcleo, o preset e a experiência', () => {
    const state = changeExperience(createRecommendationState('App', AGIL_ANSWERS), 'sometimes')
    const result = recommendationResult(state)

    expect(result.modules).not.toContain('core')
    expect(result.startedFromPreset).toBe('agil')
    expect(result.guideLevel).toBe('sometimes')
    expect(result.answers).toEqual({ ...AGIL_ANSWERS, experience: 'sometimes' })
    expect(names(moduleRows(state).on).length).toBeGreaterThan(0)
  })
})

describe('presetTitleParts', () => {
  it('separa o nome do método entre parênteses', () => {
    expect(presetTitleParts('Ágil (Scrum)')).toEqual({ base: 'Ágil', method: 'Scrum' })
  })

  it('devolve o rótulo inteiro quando não há método', () => {
    expect(presetTitleParts('Simples')).toEqual({ base: 'Simples', method: null })
  })
})
