import { describe, expect, it } from 'vitest'
import { dependencyText } from './dependency-text'

describe('texto de dependência do cartão (quadro 06)', () => {
  it('uma exigência vira "Precisa de X"', () => {
    expect(dependencyText('sprints')).toBe('Precisa de Backlog')
    expect(dependencyText('checkins')).toBe('Precisa de Sprints')
  })

  it('ferramenta sem exigência é "Independente"', () => {
    expect(dependencyText('agenda')).toBe('Independente')
  })

  it('o núcleo é "Base", como no quadro', () => {
    expect(dependencyText('core')).toBe('Base')
  })

  it('alternativas de requiresAnyOf são unidas com " ou "', () => {
    expect(dependencyText('burndown')).toBe(
      'Precisa de Sprints e Estimativa por horas ou Estimativa por pontos',
    )
  })
})
