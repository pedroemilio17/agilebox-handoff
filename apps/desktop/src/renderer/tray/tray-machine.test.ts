import { describe, expect, it } from 'vitest'
import { createInitialTrayState, initialTrayState, trayReducer, TRAY_NOTICES } from './tray-machine'

const HOME = createInitialTrayState('home')

describe('máquina de telas da bandeja', () => {
  it('nasce no aviso compacto, expande para início, abre o Kan e recolhe ao aviso', () => {
    expect(initialTrayState.screen).toEqual({ kind: 'prompt' })

    const expanded = trayReducer(initialTrayState, { type: 'expand' })
    expect(expanded.screen).toEqual({ kind: 'home' })
    expect(expanded.direction).toBe('forward')

    const kan = trayReducer(expanded, { type: 'openKan' })
    expect(kan.screen).toEqual({ kind: 'kan' })
    expect(kan.direction).toBe('forward')

    const backFromKan = trayReducer(kan, { type: 'back' })
    expect(backFromKan.screen).toEqual({ kind: 'home' })
    expect(backFromKan.direction).toBe('back')

    const collapsed = trayReducer(kan, { type: 'collapse' })
    expect(collapsed.screen).toEqual({ kind: 'prompt' })
    expect(collapsed.direction).toBe('back')
    expect(collapsed.notice).toBeNull()
  })

  it('início → atualizar → início avança e depois volta', () => {
    const opened = trayReducer(HOME, { type: 'openTask', taskId: 'T1' })
    expect(opened.screen).toEqual({ kind: 'update', taskId: 'T1', created: false })
    expect(opened.direction).toBe('forward')

    const saved = trayReducer(opened, { type: 'saved', taskId: 'T1' })
    expect(saved.screen.kind).toBe('home')
    expect(saved.direction).toBe('back')
    expect(saved.notice).toBe(TRAY_NOTICES.saved)
    expect(saved.highlightTaskId).toBe('T1')
  })

  it('voltar sem salvar não mostra aviso', () => {
    const opened = trayReducer(HOME, { type: 'openTask', taskId: 'T1' })
    const back = trayReducer(opened, { type: 'back' })
    expect(back.screen.kind).toBe('home')
    expect(back.notice).toBeNull()
    expect(back.highlightTaskId).toBeNull()
  })

  it('início → nova → atualizar: salvar ou voltar avisa "Tarefa criada" e destaca a linha', () => {
    const nova = trayReducer(HOME, { type: 'newTask' })
    expect(nova.screen.kind).toBe('new')
    const created = trayReducer(nova, { type: 'taskCreated', taskId: 'T2' })
    expect(created.screen).toEqual({ kind: 'update', taskId: 'T2', created: true })

    for (const event of [{ type: 'saved', taskId: 'T2' } as const, { type: 'back' } as const]) {
      const result = trayReducer(created, event)
      expect(result.screen.kind).toBe('home')
      expect(result.notice).toBe(TRAY_NOTICES.created)
      expect(result.highlightTaskId).toBe('T2')
    }
  })

  it('voltar da tela nova volta ao início sem aviso', () => {
    const nova = trayReducer(HOME, { type: 'newTask' })
    const back = trayReducer(nova, { type: 'back' })
    expect(back).toMatchObject({ screen: { kind: 'home' }, direction: 'back', notice: null })
  })
})

describe('máquina de telas: daily', () => {
  it('início → daily → início avança e, ao concluir, avisa "Daily registrada."', () => {
    const opened = trayReducer(HOME, { type: 'openDaily' })
    expect(opened.screen).toEqual({ kind: 'daily' })
    expect(opened.direction).toBe('forward')

    const saved = trayReducer(opened, { type: 'dailySaved' })
    expect(saved.screen.kind).toBe('home')
    expect(saved.direction).toBe('back')
    expect(saved.notice).toBe('Daily registrada.')
    expect(saved.notice).toBe(TRAY_NOTICES.daily)
  })

  it('voltar da daily sem salvar não mostra aviso', () => {
    const opened = trayReducer(HOME, { type: 'openDaily' })
    const back = trayReducer(opened, { type: 'back' })
    expect(back.screen.kind).toBe('home')
    expect(back.notice).toBeNull()
  })
})
