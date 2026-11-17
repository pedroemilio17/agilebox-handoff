import { describe, expect, it } from 'vitest'
import type { TeamToolsPreviewDto } from '@agilebox/contract'
import {
  COMING_SOON_TOOLS,
  dependentsToInclude,
  highestLevel,
  joinPt,
  levelLabel,
  uniqueIds,
} from './team-tools-rules'

const refused: TeamToolsPreviewDto = {
  ok: false,
  message: 'Não dá para desligar Backlog',
  autoEnabled: [],
  activated: [],
  windingDown: [],
  disabled: [],
  conflicts: [],
  blockedBy: ['backlog'],
  dependents: [
    { module: 'backlog', requiredBy: ['sprints', 'acceptance'] },
    { module: 'impediments', requiredBy: ['sprints'] },
  ],
  impact: [],
}

describe('regras das ferramentas da equipe', () => {
  it('une as dependentes sem repetir, na ordem em que aparecem', () => {
    expect(dependentsToInclude(refused)).toEqual(['sprints', 'acceptance'])
  })

  it('enumera em pt-BR com "e" antes do último item', () => {
    expect(joinPt([])).toBe('')
    expect(joinPt(['Backlog'])).toBe('Backlog')
    expect(joinPt(['Backlog', 'Sprints'])).toBe('Backlog e Sprints')
    expect(joinPt(['A', 'B', 'C'])).toBe('A, B e C')
  })

  it('escolhe o maior nível exigido entre os avisos', () => {
    expect(highestLevel([])).toBeNull()
    expect(highestLevel(['intermediate', 'advanced', 'basic'])).toBe('advanced')
    expect(highestLevel(['intermediate'])).toBe('intermediate')
  })

  it('usa rótulos pt-BR de nível e remove duplicatas de ids', () => {
    expect(levelLabel('basic')).toBe('Básico')
    expect(levelLabel('intermediate')).toBe('Intermediário')
    expect(levelLabel('advanced')).toBe('Avançado')
    expect(uniqueIds(['a', 'b', 'a'])).toEqual(['a', 'b'])
  })

  it('marca só as ferramentas sem entrega como "Em breve"', () => {
    expect([...COMING_SOON_TOOLS].sort()).toEqual(['estimates.points', 'integrations'])
  })
})
