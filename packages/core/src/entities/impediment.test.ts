import { describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '../shared/errors'
import { toImpedimentId, toOrganizationId, toTaskId, toUserId } from '../shared/ids'
import {
  assignImpediment,
  changeImpedimentReason,
  openImpediment,
  resolveImpediment,
} from './impediment'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(9))
const task = toTaskId(id(3))
const ana = toUserId(id(1))
const bia = toUserId(id(2))
const at = '2026-01-02T10:00:00.000Z'

function aOpen() {
  return openImpediment({
    id: toImpedimentId(id(7)),
    organizationId: org,
    taskId: task,
    reason: '  Aguardando credenciais ',
    ownerId: ana,
    openedBy: bia,
    openedAt: at,
  })
}

describe('impedimento', () => {
  it('abre com motivo aparado, estado aberto e sem resolução', () => {
    expect(aOpen()).toMatchObject({
      reason: 'Aguardando credenciais',
      status: 'open',
      ownerId: ana,
      openedBy: bia,
      openedAt: at,
      resolvedBy: null,
      resolvedAt: null,
      resolution: null,
    })
  })

  it('recusa motivo vazio ou com mais de 280 caracteres', () => {
    const base = {
      id: toImpedimentId(id(7)),
      organizationId: org,
      taskId: task,
      ownerId: null,
      openedBy: bia,
      openedAt: at,
    }
    expect(() => openImpediment({ ...base, reason: '  ' })).toThrow(ValidationError)
    expect(() => openImpediment({ ...base, reason: 'x'.repeat(281) })).toThrow(ValidationError)
  })

  it('resolve com nota aparada; nota vazia vira nula; nota longa é recusada', () => {
    const resolved = resolveImpediment(
      aOpen(),
      bia,
      '2026-01-03T10:00:00.000Z',
      '  Acesso liberado  ',
    )
    expect(resolved).toMatchObject({
      status: 'resolved',
      resolvedBy: bia,
      resolvedAt: '2026-01-03T10:00:00.000Z',
      resolution: 'Acesso liberado',
    })
    expect(resolveImpediment(aOpen(), bia, at, '   ').resolution).toBeNull()
    expect(() => resolveImpediment(aOpen(), bia, at, 'x'.repeat(281))).toThrow(ValidationError)
  })

  it('resolvido não resolve de novo, não troca responsável nem muda o motivo', () => {
    const resolved = resolveImpediment(aOpen(), bia, at, null)
    expect(() => resolveImpediment(resolved, bia, at, null)).toThrow(ConflictError)
    expect(() => assignImpediment(resolved, bia)).toThrow(ConflictError)
    expect(() => changeImpedimentReason(resolved, 'Outro')).toThrow(ConflictError)
  })

  it('troca ou limpa o responsável; igual ao atual devolve o mesmo registro', () => {
    const open = aOpen()
    expect(assignImpediment(open, ana)).toBe(open)
    expect(assignImpediment(open, bia).ownerId).toBe(bia)
    expect(assignImpediment(open, null).ownerId).toBeNull()
  })

  it('muda o motivo do aberto; igual ao atual devolve o mesmo registro', () => {
    const open = aOpen()
    expect(changeImpedimentReason(open, 'Aguardando credenciais')).toBe(open)
    expect(changeImpedimentReason(open, 'Rede caiu').reason).toBe('Rede caiu')
  })
})
