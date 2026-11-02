import { describe, expect, it } from 'vitest'
import { dependencyText } from './dependency-text'

describe('texto de dependência do cartão', () => {
  it('uma exigência vira "Depende de X."', () => {
    expect(dependencyText('sprints')).toBe('Depende de Backlog.')
    expect(dependencyText('checkins')).toBe('Depende de Sprints.')
  })

  it('ferramenta sem exigência diz que não tem dependências', () => {
    expect(dependencyText('agenda')).toBe('Sem dependências.')
  })

  it('o núcleo diz que é a base do time', () => {
    expect(dependencyText('core')).toBe('Base do time, sempre ligada.')
  })

  it('alternativas de requiresAnyOf são unidas com " ou "', () => {
    expect(dependencyText('burndown')).toBe(
      'Depende de Sprints e Estimativa por horas ou Estimativa por pontos.',
    )
  })
})
