import { describe, expect, it } from 'vitest'
import { planDisableModules, planEnableModules } from './project-modules'

const IDLE = { hasActiveSprint: false }
const ACTIVE_SPRINT = { hasActiveSprint: true }

describe('planEnableModules', () => {
  it('liga junto o que o módulo requer e avisa quais foram', () => {
    const plan = planEnableModules(['core'], ['sprints'])
    expect(plan).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints'],
      autoEnabled: ['backlog'],
    })
  })

  it('custo liga a estimativa junto', () => {
    const plan = planEnableModules(['core'], ['cost'])
    expect(plan).toMatchObject({ ok: true, autoEnabled: ['estimates.hours'] })
  })

  it('recusa módulos em conflito', () => {
    const plan = planEnableModules(['core', 'estimates.hours'], ['estimates.points'])
    expect(plan).toMatchObject({ ok: false, reason: 'conflict' })
  })
})

describe('planDisableModules', () => {
  it('desliga junto os dependentes, sem apagar nada', () => {
    const current = ['core', 'backlog', 'estimates.hours', 'sprints', 'burndown'] as const
    const plan = planDisableModules(current, ['backlog'], IDLE)
    expect(plan).toMatchObject({
      ok: true,
      disableNow: ['backlog', 'sprints', 'burndown'],
      cascadeDisabled: ['sprints', 'burndown'],
      scheduled: [],
      enabled: ['core', 'estimates.hours'],
    })
  })

  it('desligar o que ninguém exige só desliga ele', () => {
    const plan = planDisableModules(['core', 'backlog', 'sprints'], ['sprints'], IDLE)
    expect(plan).toMatchObject({
      ok: true,
      disableNow: ['sprints'],
      cascadeDisabled: [],
      enabled: ['core', 'backlog'],
    })
  })

  it('sprint ativa agenda o desligamento: nada muda agora', () => {
    const current = ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'] as const
    const plan = planDisableModules(current, ['sprints'], ACTIVE_SPRINT)
    expect(plan).toMatchObject({
      ok: true,
      disableNow: [],
      cascadeDisabled: ['burndown'],
      scheduled: [{ moduleId: 'sprints', block: { reason: 'active_sprint', scheduleAtEnd: true } }],
      enabled: ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'],
    })
  })

  it('sprint ativa não segura quem não depende de sprints', () => {
    const plan = planDisableModules(['core', 'backlog', 'sprints'], ['backlog'], ACTIVE_SPRINT)
    // backlog arrasta sprints, que está bloqueado: o pedido todo fica agendado.
    expect(plan).toMatchObject({ ok: true, disableNow: [], scheduled: [{ moduleId: 'sprints' }] })
    const other = planDisableModules(['core', 'wip'], ['wip'], ACTIVE_SPRINT)
    expect(other).toMatchObject({ ok: true, disableNow: ['wip'], scheduled: [] })
  })

  it('o núcleo não desliga', () => {
    expect(planDisableModules(['core'], ['core'], IDLE)).toEqual({
      ok: false,
      reason: 'core_required',
    })
  })

  it('módulo que já está desligado não muda nada', () => {
    const plan = planDisableModules(['core'], ['wip'], IDLE)
    expect(plan).toMatchObject({ ok: true, disableNow: [], scheduled: [], enabled: ['core'] })
  })
})
