import { describe, expect, it } from 'vitest'
import { getWelcomeState, firstName } from './welcome-state'
import { GUIDE_PROJECT_ID, makeGuide, WELCOME_AGIL } from './guide-fixtures'

const SHOWN = { showWelcome: true, welcome: WELCOME_AGIL, doneCount: 0 } as const

describe('getWelcomeState', () => {
  it('aparece com showWelcome, o bloco welcome e trilha não vazia', () => {
    const state = getWelcomeState(makeGuide(SHOWN), 'Rita Souza')
    expect(state.visible).toBe(true)
    expect(state.title).toBe('Boas-vindas ao App de Chamados, Rita')
    expect(state.stepCount).toBe(7)
    expect(state.steps[0]).toEqual({
      key: 'backlog.list',
      title: 'Liste o que precisa ser feito',
      moduleName: 'Backlog',
    })
    expect(state.steps).toHaveLength(7)
  })

  it('não aparece sem showWelcome, sem welcome ou sem trilha', () => {
    expect(getWelcomeState(makeGuide({ ...SHOWN, showWelcome: false })).visible).toBe(false)
    expect(getWelcomeState(makeGuide({ showWelcome: true, welcome: null })).visible).toBe(false)
    expect(
      getWelcomeState({ ...makeGuide(SHOWN), trail: [], total: 0, currentKey: null }).visible,
    ).toBe(false)
    expect(getWelcomeState(undefined).visible).toBe(false)
  })

  it('o preset Simples (sem trilha) não mostra a janela', () => {
    const simples = {
      projectName: 'Projeto',
      presetKey: 'simples' as const,
      presetLabel: 'Simples',
      moduleCount: 0,
    }
    const guide = { ...makeGuide(SHOWN), trail: [], total: 0, currentKey: null, welcome: simples }
    expect(getWelcomeState(guide).visible).toBe(false)
  })

  it('a intro cita o preset, no singular e no plural', () => {
    expect(getWelcomeState(makeGuide(SHOWN)).intro).toBe(
      'Este projeto começou como Ágil: 5 módulos ligados.',
    )
    const um = { ...WELCOME_AGIL, moduleCount: 1 }
    expect(getWelcomeState(makeGuide({ ...SHOWN, welcome: um })).intro).toBe(
      'Este projeto começou como Ágil: 1 módulo ligado.',
    )
  })

  it('sem preset, a intro diz só quantos módulos estão ligados', () => {
    const sem = { ...WELCOME_AGIL, presetKey: null, presetLabel: null, moduleCount: 2 }
    expect(getWelcomeState(makeGuide({ ...SHOWN, welcome: sem })).intro).toBe(
      'Este projeto usa 2 módulos ligados.',
    )
    const nucleo = { ...sem, moduleCount: 0 }
    expect(getWelcomeState(makeGuide({ ...SHOWN, welcome: nucleo })).intro).toBe(
      'Este projeto usa só o núcleo.',
    )
  })

  it('o título sem nome da pessoa usa só o projeto', () => {
    expect(getWelcomeState(makeGuide(SHOWN)).title).toBe('Boas-vindas ao App de Chamados')
    expect(getWelcomeState(makeGuide(SHOWN), '   ').title).toBe('Boas-vindas ao App de Chamados')
  })

  it('usa o identificador do projeto do guia sem alterar a trilha', () => {
    const state = getWelcomeState(makeGuide({ ...SHOWN, projectId: GUIDE_PROJECT_ID }))
    expect(state.steps.map((step) => step.key)).toContain('ceremonies.planning')
  })
})

describe('firstName', () => {
  it('pega o primeiro nome e devolve null sem nome', () => {
    expect(firstName('  Ana   Souza ')).toBe('Ana')
    expect(firstName('')).toBeNull()
    expect(firstName(undefined)).toBeNull()
  })
})
