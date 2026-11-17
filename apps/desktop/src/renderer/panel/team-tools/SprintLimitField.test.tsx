import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { teamToolsView } from '../../shared/testing/team-tools-fixture'
import { parseSprintLimit, SprintLimitField, sprintLimitOf } from './SprintLimitField'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('parseSprintLimit e sprintLimitOf', () => {
  it('aceita inteiros de 1 a 5 e recusa o resto', () => {
    expect(parseSprintLimit('1')).toBe(1)
    expect(parseSprintLimit(' 5 ')).toBe(5)
    expect(parseSprintLimit('0')).toBeNull()
    expect(parseSprintLimit('6')).toBeNull()
    expect(parseSprintLimit('2,5')).toBeNull()
    expect(parseSprintLimit('')).toBeNull()
    expect(parseSprintLimit('-1')).toBeNull()
  })

  it('sem configuração, o limite é o padrão do domínio (uma sprint ativa)', () => {
    expect(sprintLimitOf(undefined)).toBe(1)
    expect(sprintLimitOf({ maxActiveSprints: 3 })).toBe(3)
  })
})

describe('Sprints ativas ao mesmo tempo (ferramenta Sprints)', () => {
  it('gestor vê o campo, valida e grava pelo módulo', async () => {
    const api = createFakeApi()
    const setConfig = vi
      .spyOn(api.teamTools, 'setModuleConfig')
      .mockResolvedValue(teamToolsView({ modules: [], level: 'advanced', role: 'manager' }))
    renderPanel(<SprintLimitField value={1} canManage />, { api })
    const user = userEvent.setup()
    const input = screen.getByLabelText<HTMLInputElement>('Sprints ativas ao mesmo tempo')
    expect(input.value).toBe('1')

    fireEvent.change(input, { target: { value: '9' } })
    await user.click(screen.getByRole('button', { name: 'Salvar limite' }))
    expect(screen.getByRole('alert').textContent).toBe(
      'Limite de sprints ativas deve ser um número inteiro de 1 a 5',
    )
    expect(setConfig).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '3' } })
    await user.click(screen.getByRole('button', { name: 'Salvar limite' }))
    await waitFor(() =>
      expect(setConfig).toHaveBeenCalledWith({
        moduleId: 'sprints',
        config: { maxActiveSprints: 3 },
      }),
    )
  })

  it('mostra o estado de salvando enquanto grava', async () => {
    const api = createFakeApi()
    let finish: (value: unknown) => void = () => undefined
    vi.spyOn(api.teamTools, 'setModuleConfig').mockImplementation(
      () => new Promise((resolve) => (finish = resolve)) as never,
    )
    renderPanel(<SprintLimitField value={2} canManage />, { api })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Salvar limite' }))
    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeTruthy()
    finish(teamToolsView({ modules: [], level: 'advanced', role: 'manager' }))
  })

  it('mostra a recusa do servidor em pt-BR', async () => {
    const api = createFakeApi()
    vi.spyOn(api.teamTools, 'setModuleConfig').mockRejectedValue(
      new ApiError('VALIDATION', 'Limite de sprints ativas deve ser um número inteiro de 1 a 5'),
    )
    renderPanel(<SprintLimitField value={2} canManage />, { api })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Salvar limite' }))
    expect(
      await screen.findByText('Limite de sprints ativas deve ser um número inteiro de 1 a 5'),
    ).toBeTruthy()
  })

  it('colaborador vê o valor em leitura, sem campo nem gravação', () => {
    const api = createFakeApi()
    renderPanel(<SprintLimitField value={4} canManage={false} />, { api })
    expect(screen.queryByLabelText('Sprints ativas ao mesmo tempo')).toBeNull()
    expect(screen.getByText('Sprints ativas ao mesmo tempo: 4')).toBeTruthy()
  })
})
