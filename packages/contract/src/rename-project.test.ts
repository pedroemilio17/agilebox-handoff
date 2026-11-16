import { describe, expect, it } from 'vitest'
import { API_CHANNELS, API_SCHEMA_REGISTRY } from './index'
import { renameProjectInputSchema } from './projects'

const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

describe('schemas de renomear projeto', () => {
  it('registra o canal projects.rename com schemas de entrada e saída', () => {
    expect(API_CHANNELS).toContain('projects.rename')
    expect(API_SCHEMA_REGISTRY['projects.rename'].input).toBeDefined()
    expect(API_SCHEMA_REGISTRY['projects.rename'].output).toBeDefined()
  })

  it('aceita um id válido e um nome, aparando espaços', () => {
    expect(renameProjectInputSchema.parse({ projectId, name: '  Novo nome  ' })).toEqual({
      projectId,
      name: 'Novo nome',
    })
  })

  it('recusa nome vazio, nome só com espaços e id inválido', () => {
    expect(() => renameProjectInputSchema.parse({ projectId, name: '   ' })).toThrow()
    expect(() => renameProjectInputSchema.parse({ projectId, name: '' })).toThrow()
    expect(() => renameProjectInputSchema.parse({ projectId: 'x', name: 'Nome' })).toThrow()
  })
})
