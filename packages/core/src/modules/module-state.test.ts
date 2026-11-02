import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import {
  canAcceptNewItems,
  canUseExistingItems,
  transitionModuleState,
  MODULE_STATES,
} from './module-state'
import type { ModuleState, ModuleStateEvent } from './module-state'

const EVENTS: readonly ModuleStateEvent[] = ['startWindingDown', 'finishWindingDown', 'reactivate']

/** Única lista de transições válidas: qualquer par fora dela tem que ser recusado. */
const VALID: readonly [ModuleState, ModuleStateEvent, ModuleState][] = [
  ['active', 'startWindingDown', 'winding_down'],
  ['winding_down', 'finishWindingDown', 'disabled'],
  ['winding_down', 'reactivate', 'active'],
  ['disabled', 'reactivate', 'active'],
]

describe('estado do módulo', () => {
  it('tem os três estados do plano, nesta ordem', () => {
    expect(MODULE_STATES).toEqual(['active', 'winding_down', 'disabled'])
  })

  it('aceita cada transição válida e devolve o novo estado', () => {
    for (const [from, event, to] of VALID) {
      expect(transitionModuleState(from, event), `${from} + ${event}`).toBe(to)
    }
  })

  it('recusa com ValidationError toda transição que não existe', () => {
    const invalid = MODULE_STATES.flatMap((state) =>
      EVENTS.filter((event) => !VALID.some(([from, e]) => from === state && e === event)).map(
        (event) => [state, event] as const,
      ),
    )
    expect(invalid.length).toBeGreaterThan(0)
    for (const [state, event] of invalid) {
      expect(() => transitionModuleState(state, event), `${state} + ${event}`).toThrow(
        ValidationError,
      )
    }
  })

  it('não se encerra um módulo que já está desativado nem se conclui um que está ativo', () => {
    expect(() => transitionModuleState('disabled', 'startWindingDown')).toThrow(ValidationError)
    expect(() => transitionModuleState('active', 'finishWindingDown')).toThrow(ValidationError)
  })

  it('só o módulo ativo aceita itens novos', () => {
    expect(canAcceptNewItems('active')).toBe(true)
    expect(canAcceptNewItems('winding_down')).toBe(false)
    expect(canAcceptNewItems('disabled')).toBe(false)
  })

  it('em encerramento, itens existentes continuam usáveis; desativado não', () => {
    expect(canUseExistingItems('active')).toBe(true)
    expect(canUseExistingItems('winding_down')).toBe(true)
    expect(canUseExistingItems('disabled')).toBe(false)
  })

  it('reativar não altera os dados: a função só recebe e devolve o estado', () => {
    const data = { sprints: [{ id: 's1', name: 'Sprint 4' }] }
    const snapshot = structuredClone(data)

    const reactivated = transitionModuleState('disabled', 'reactivate')

    expect(reactivated).toBe('active')
    expect(data).toEqual(snapshot)
    expect(canAcceptNewItems(reactivated)).toBe(true)
  })

  it('reativar pelo encerramento cancela a saída sem perder nada', () => {
    const state = transitionModuleState('active', 'startWindingDown')
    expect(state).toBe('winding_down')
    expect(transitionModuleState(state, 'reactivate')).toBe('active')
  })
})
