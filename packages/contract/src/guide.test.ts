import { describe, expect, it } from 'vitest'
import { guideViewDtoSchema, resolveGuideWelcomeInputSchema } from './guide'

const PROJECT_ID = '01ARZ3NDEKTSV4RRFFQ69G5FD5'

/** Visão do guia sem trilha e sem janela: a base de cada teste. */
const baseView = {
  projectId: PROJECT_ID,
  trail: [],
  done: 0,
  total: 0,
  currentKey: null,
  experience: 'never',
  intensity: {
    firstStepsCard: 'open',
    emptyState: 'full',
    firstTimeHints: true,
    explainJargon: true,
  },
  cardDismissed: false,
  showWelcome: false,
  welcome: null,
}

describe('contrato do guia: janela de boas-vindas', () => {
  it('aceita a visão sem janela (welcome nulo)', () => {
    expect(guideViewDtoSchema.safeParse(baseView).success).toBe(true)
  })

  it('aceita a janela com preset e sem preset', () => {
    const comPreset = {
      ...baseView,
      showWelcome: true,
      welcome: { projectName: 'Projeto', presetKey: 'agil', presetLabel: 'Ágil', moduleCount: 5 },
    }
    const semPreset = {
      ...baseView,
      showWelcome: true,
      welcome: { projectName: 'Projeto', presetKey: null, presetLabel: null, moduleCount: 0 },
    }
    expect(guideViewDtoSchema.safeParse(comPreset).success).toBe(true)
    expect(guideViewDtoSchema.safeParse(semPreset).success).toBe(true)
  })

  it('recusa preset fora da lista de presets e contagem negativa', () => {
    const presetInvalido = {
      ...baseView,
      showWelcome: true,
      welcome: { projectName: 'Projeto', presetKey: 'cascata', presetLabel: 'X', moduleCount: 1 },
    }
    const contagemNegativa = {
      ...baseView,
      showWelcome: true,
      welcome: { projectName: 'Projeto', presetKey: null, presetLabel: null, moduleCount: -1 },
    }
    expect(guideViewDtoSchema.safeParse(presetInvalido).success).toBe(false)
    expect(guideViewDtoSchema.safeParse(contagemNegativa).success).toBe(false)
  })

  it('exige showWelcome na visão', () => {
    const { showWelcome: _ignored, ...semCampo } = baseView
    void _ignored
    expect(guideViewDtoSchema.safeParse(semCampo).success).toBe(false)
  })

  it('resolveWelcome recebe só o id do projeto', () => {
    expect(resolveGuideWelcomeInputSchema.safeParse({ projectId: PROJECT_ID }).success).toBe(true)
    expect(resolveGuideWelcomeInputSchema.safeParse({ projectId: 'nao-e-ulid' }).success).toBe(
      false,
    )
  })
})
