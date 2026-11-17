import { describe, expect, it } from 'vitest'
import type { ImpedimentListItemDto, SessionUserDto } from '@agilebox/contract'
import { makeParticipation, OTHER_USER_ID, USER_ID } from '../task-detail/fixtures'
import { impedimentCopy } from './impediment-copy'
import {
  byOldestFirst,
  ownerCandidates,
  ownerIdFromSelect,
  ownerValue,
  RESOLUTION_MAX_LENGTH,
  validateResolutionInput,
} from './impediment-rules'

const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V09'

const user = (id: string, name: string, role: SessionUserDto['role']): SessionUserDto => ({
  id,
  name,
  initials: name.slice(0, 2).toUpperCase(),
  role,
  defaultRate: 0,
})

describe('Nota de resolução', () => {
  it('aceita vazia e até 280 caracteres (contando sem os espaços das pontas)', () => {
    expect(validateResolutionInput('')).toBeNull()
    expect(validateResolutionInput(`  ${'a'.repeat(RESOLUTION_MAX_LENGTH)}  `)).toBeNull()
  })

  it('recusa 281 caracteres com a mensagem em português', () => {
    expect(validateResolutionInput('a'.repeat(RESOLUTION_MAX_LENGTH + 1))).toBe(
      impedimentCopy.resolutionTooLong,
    )
  })

  it('conta caracteres, não bytes (acento conta como um)', () => {
    expect(validateResolutionInput('é'.repeat(RESOLUTION_MAX_LENGTH))).toBeNull()
    expect(validateResolutionInput('é'.repeat(RESOLUTION_MAX_LENGTH + 1))).not.toBeNull()
  })
})

describe('Responsável', () => {
  it('"Sem responsável" é texto vazio no seletor e null no servidor', () => {
    expect(ownerValue(null)).toBe('')
    expect(ownerIdFromSelect('')).toBeNull()
    expect(ownerIdFromSelect(USER_ID)).toBe(USER_ID)
  })

  it('quem pode resolver: participantes da tarefa primeiro, depois gestores, sem repetir', () => {
    const candidates = ownerCandidates(
      {
        participations: [
          makeParticipation({
            participant: { kind: 'user', userId: USER_ID },
            participantName: 'Ana',
          }),
          // Colaborador só por contribuição (sem usuário) não pode ser responsável.
          makeParticipation({
            id: '01J8Y4G2XK8Z1S6M3Q9W0A5P02',
            participant: { kind: 'contributor', contributorId: OTHER_USER_ID },
            participantName: 'Externo',
            role: 'support',
          }),
        ],
      },
      [
        user(USER_ID, 'Ana', 'collaborator'),
        user(OTHER_USER_ID, 'Bruno', 'collaborator'),
        user(MANAGER, 'Lia', 'manager'),
        user(USER_ID, 'Ana', 'collaborator'),
      ],
    )
    expect(candidates).toEqual([
      { id: USER_ID, name: 'Ana' },
      { id: MANAGER, name: 'Lia' },
    ])
  })

  it('sem detalhe carregado, só aparecem os gestores', () => {
    expect(ownerCandidates(undefined, [user(MANAGER, 'Lia', 'manager')])).toEqual([
      { id: MANAGER, name: 'Lia' },
    ])
  })
})

describe('Ordem da lista', () => {
  const item = (id: string, openedAt: string) =>
    ({ id, openedAt }) as Pick<ImpedimentListItemDto, 'id' | 'openedAt'>

  it('mais antigos primeiro e, no empate, pelo id', () => {
    const rows = [
      item('B', '2026-11-05T10:00:00.000Z'),
      item('C', '2026-11-01T10:00:00.000Z'),
      item('A', '2026-11-05T10:00:00.000Z'),
    ]
    expect([...rows].sort(byOldestFirst).map((row) => row.id)).toEqual(['C', 'A', 'B'])
  })
})
