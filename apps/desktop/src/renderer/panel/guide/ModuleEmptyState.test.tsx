import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getManifest } from '@agilebox/core'
import { renderPanel } from '../../shared/testing/render-panel'
import { createFakeApi, hiddenGuide } from '../../shared/testing/fake-api'
import { ModuleEmptyState } from './ModuleEmptyState'
import { GUIDE_PROJECT_ID } from './guide-fixtures'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const backlog = getManifest('backlog')

function setupGuide(intensity: 'full' | 'short' | null) {
  const api = createFakeApi()
  if (intensity === null) {
    vi.spyOn(api.guide, 'get').mockRejectedValue(new Error('falha'))
  } else {
    vi.spyOn(api.guide, 'get').mockResolvedValue({
      ...hiddenGuide(GUIDE_PROJECT_ID),
      intensity: { ...hiddenGuide(GUIDE_PROJECT_ID).intensity, emptyState: intensity },
    })
  }
  return api
}

describe('ModuleEmptyState', () => {
  it('com guia em intensidade full mostra a frase do manifesto e a explicação com exemplo', async () => {
    renderPanel(
      <ModuleEmptyState
        moduleId="backlog"
        projectId={GUIDE_PROJECT_ID}
        fallbackTitle="Texto antigo"
        fallbackDescription="Descrição antiga"
      />,
      { api: setupGuide('full') },
    )
    expect(await screen.findByRole('heading', { name: backlog.emptyState.short })).toBeTruthy()
    expect(screen.getByText(backlog.emptyState.full)).toBeTruthy()
    expect(screen.queryByText('Texto antigo')).toBeNull()
  })

  it('com intensidade short mostra só a frase do manifesto', async () => {
    renderPanel(
      <ModuleEmptyState
        moduleId="backlog"
        projectId={GUIDE_PROJECT_ID}
        fallbackTitle="Texto antigo"
        fallbackDescription="Descrição antiga"
      />,
      { api: setupGuide('short') },
    )
    expect(await screen.findByRole('heading', { name: backlog.emptyState.short })).toBeTruthy()
    expect(screen.queryByText(backlog.emptyState.full)).toBeNull()
  })

  it('sem projeto usa o fallback e não consulta o guia', () => {
    const api = setupGuide('full')
    renderPanel(
      <ModuleEmptyState
        moduleId="backlog"
        projectId={null}
        fallbackTitle="Texto antigo"
        fallbackDescription="Descrição antiga"
      />,
      { api },
    )
    expect(screen.getByRole('heading', { name: 'Texto antigo' })).toBeTruthy()
    expect(screen.getByText('Descrição antiga')).toBeTruthy()
    expect(api.guide.get).not.toHaveBeenCalled()
  })

  it('com erro no guia usa o fallback sem atrapalhar a tela', async () => {
    renderPanel(
      <ModuleEmptyState
        moduleId="backlog"
        projectId={GUIDE_PROJECT_ID}
        fallbackTitle="Texto antigo"
        fallbackDescription="Descrição antiga"
      />,
      { api: setupGuide(null) },
    )
    expect(await screen.findByRole('heading', { name: 'Texto antigo' })).toBeTruthy()
    expect(screen.getByText('Descrição antiga')).toBeTruthy()
  })

  it('mostra a ação passada como filho', () => {
    renderPanel(
      <ModuleEmptyState moduleId="backlog" projectId={null} fallbackTitle="Vazio">
        <button type="button">Criar</button>
      </ModuleEmptyState>,
    )
    expect(screen.getByRole('button', { name: 'Criar' })).toBeTruthy()
  })
})
