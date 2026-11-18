import { describe, expect, it } from 'vitest'
import type { ProjectModuleEventDto } from '@agilebox/contract'
import { historyActionText, historyDateText } from './modules-history'

const BASE: ProjectModuleEventDto = {
  id: 1,
  at: '2026-11-16T12:00:00.000Z',
  action: 'enabled',
  moduleId: 'sprints',
  moduleName: 'Sprints',
  auto: false,
  relatedModuleId: null,
  relatedModuleName: null,
  actorId: '00000000000000000000000012',
  actorName: 'Gestora Ana',
  actorRole: 'manager',
}

describe('historyActionText', () => {
  it('pedido direto: "Ligou Sprints" e "Desligou Backlog", sem parênteses', () => {
    expect(historyActionText(BASE)).toBe('Ligou Sprints')
    expect(historyActionText({ ...BASE, action: 'disabled', moduleName: 'Backlog' })).toBe(
      'Desligou Backlog',
    )
  })

  it('mudança por dependência diz qual módulo a puxou', () => {
    expect(
      historyActionText({
        ...BASE,
        action: 'disabled',
        moduleName: 'Burndown',
        auto: true,
        relatedModuleId: 'sprints',
        relatedModuleName: 'Sprints',
      }),
    ).toBe('Desligou Burndown (junto com Sprints)')
  })

  it('dependência sem módulo relacionado conhecido cai num texto genérico', () => {
    expect(historyActionText({ ...BASE, auto: true, moduleName: 'Backlog' })).toBe(
      'Ligou Backlog (junto com outro módulo)',
    )
  })

  it('desligamento agendado diz que nada foi desligado; encerramento e cancelamento têm texto próprio', () => {
    expect(historyActionText({ ...BASE, action: 'scheduled_disable', moduleName: 'Sprints' })).toBe(
      'Pediu para desligar Sprints com a sprint ativa (nada foi desligado)',
    )
    expect(historyActionText({ ...BASE, action: 'winding_down', moduleName: 'Sprints' })).toBe(
      'Pôs Sprints em encerramento',
    )
    expect(historyActionText({ ...BASE, action: 'cancelled', moduleName: 'Sprints' })).toBe(
      'Cancelou o desligamento agendado de Sprints',
    )
  })
})

describe('historyDateText', () => {
  it('formata data e hora em pt-BR e devolve o texto original quando a data é inválida', () => {
    expect(historyDateText('2026-11-16T12:00:00.000Z')).toMatch(/16\/11\/2026/)
    expect(historyDateText('não é data')).toBe('não é data')
  })
})
