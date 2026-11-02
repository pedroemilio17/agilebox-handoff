import { describe, expect, it } from 'vitest'
import { API_CHANNELS, API_SCHEMA_REGISTRY, SHELL_CHANNELS, SHELL_SCHEMA_REGISTRY } from './index'

describe('contratos de API e da janela', () => {
  it('associa todos os métodos do plano a um canal e schemas de entrada e saída', () => {
    expect(Object.keys(API_SCHEMA_REGISTRY).sort()).toEqual([...API_CHANNELS].sort())
    for (const channel of API_CHANNELS) {
      expect(API_SCHEMA_REGISTRY[channel].input).toBeDefined()
      expect(API_SCHEMA_REGISTRY[channel].output).toBeDefined()
    }
  })

  it('expõe os canais de critérios de aceite e de estimativa (M3.8b)', () => {
    expect(API_CHANNELS).toEqual(
      expect.arrayContaining([
        'acceptance.list',
        'acceptance.add',
        'acceptance.edit',
        'acceptance.setDone',
        'acceptance.remove',
        'acceptance.reorder',
        'estimates.set',
      ]),
    )
  })

  it('associa todos os controles da janela a um canal e schemas', () => {
    expect(Object.keys(SHELL_SCHEMA_REGISTRY).sort()).toEqual([...SHELL_CHANNELS].sort())
    for (const channel of SHELL_CHANNELS) {
      expect(SHELL_SCHEMA_REGISTRY[channel].input).toBeDefined()
      expect(SHELL_SCHEMA_REGISTRY[channel].output).toBeDefined()
    }
  })
})
