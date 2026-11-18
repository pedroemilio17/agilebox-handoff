import { describe, expect, it } from 'vitest'
import { methodologyLabel } from './methodology-label'

describe('rótulo da metodologia na barra lateral', () => {
  it('usa os rótulos do design para cada preset de partida', () => {
    expect(methodologyLabel('agil')).toBe('Ágil')
    expect(methodologyLabel('kanban')).toBe('Kanban')
    expect(methodologyLabel('tradicional')).toBe('Trad.')
    expect(methodologyLabel('hibrido')).toBe('Híbrido')
    expect(methodologyLabel('simples')).toBe('Simples')
  })

  it('sem preset de partida, não mostra rótulo', () => {
    expect(methodologyLabel(null)).toBeNull()
    expect(methodologyLabel(undefined)).toBeNull()
  })
})
