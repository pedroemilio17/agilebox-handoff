import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WIZARD_DRAFT,
  WIZARD_QUESTIONS,
  toGuideExperience,
  toWizardAnswers,
  withAnswer,
} from './wizard-steps'

describe('perguntas do novo projeto (novo-projeto.html)', () => {
  it('define exatamente as 3 perguntas humanas do protótipo', () => {
    expect(WIZARD_QUESTIONS.map((q) => q.question)).toEqual([
      'Como o time prefere organizar as entregas?',
      'Há clientes ou parceiros externos que precisam de previsibilidade?',
      'Como você descreve a experiência da equipe com organização?',
    ])
    expect(WIZARD_QUESTIONS[0]?.columns).toBe(3)
    expect(WIZARD_QUESTIONS[1]?.columns).toBe(2)
    expect(WIZARD_QUESTIONS[2]?.columns).toBe(3)
  })

  it('começa com os padrões pré-selecionados do HTML', () => {
    expect(DEFAULT_WIZARD_DRAFT).toEqual({
      deliveryMode: 'continuo',
      externalVisibility: 'nao',
      experience: 'Iniciante',
    })
  })

  it('registra respostas válidas e rejeita opção inválida', () => {
    const next = withAnswer(DEFAULT_WIZARD_DRAFT, 'deliveryMode', 'ciclos')
    expect(next.deliveryMode).toBe('ciclos')
    expect(() => withAnswer(DEFAULT_WIZARD_DRAFT, 'deliveryMode', 'invalido')).toThrow()
  })

  it('mapeia a experiência para GuideExperience', () => {
    expect(toGuideExperience('Iniciante')).toBe('never')
    expect(toGuideExperience('Intermediário')).toBe('sometimes')
    expect(toGuideExperience('Experiente')).toBe('always')
  })

  it('converte cada modo de entrega para WizardAnswers do domínio', () => {
    expect(toWizardAnswers(DEFAULT_WIZARD_DRAFT)).toEqual({
      workType: 'continuous',
      outsiderFollows: 'no',
      experience: 'never',
    })
    expect(
      toWizardAnswers({
        deliveryMode: 'ciclos',
        externalVisibility: 'sim',
        experience: 'Intermediário',
      }),
    ).toEqual({
      workType: 'finite',
      fixedDate: 'no',
      scope: 'will_change',
      outsiderFollows: 'yes',
      experience: 'sometimes',
    })
    expect(
      toWizardAnswers({
        deliveryMode: 'cronograma',
        externalVisibility: 'nao',
        experience: 'Experiente',
      }),
    ).toEqual({
      workType: 'finite',
      fixedDate: 'yes',
      scope: 'defined',
      outsiderFollows: 'no',
      experience: 'always',
    })
  })
})
