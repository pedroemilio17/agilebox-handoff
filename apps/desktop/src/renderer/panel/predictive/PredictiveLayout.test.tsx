import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import type { PanelView } from '../layout/PanelShell'
import { PredictiveLayout } from './PredictiveLayout'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0FGHKA'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const ITEMS = [
  { id: 'schedule' as const, label: 'Cronograma' },
  { id: 'milestones' as const, label: 'Marcos' },
  { id: 'baseline' as const, label: 'Plano salvo' },
]

function setup({
  activeId = 'schedule',
  items = ITEMS,
  projectId = PROJECT_ID,
  onSelect = vi.fn(),
}: {
  readonly activeId?: PanelView
  readonly items?: readonly { readonly id: PanelView; readonly label: string }[]
  readonly projectId?: string | null
  readonly onSelect?: (id: PanelView) => void
} = {}) {
  const api = createFakeApi()
  const track = vi.spyOn(api.tracking, 'get')
  renderPanel(
    <PredictiveLayout
      ariaLabel="Seções de Cronograma"
      items={items}
      activeId={activeId}
      onSelect={onSelect}
      projectId={projectId}
    >
      <p>Conteúdo da tela</p>
    </PredictiveLayout>,
    { api },
  )
  return { onSelect, track }
}

describe('Fluxo Preditivo: rail de tópicos', () => {
  it('lista os tópicos do grupo, marca o atual com aria-current e leva os outros para a tela', async () => {
    const { onSelect } = setup()
    const rail = within(screen.getByRole('navigation', { name: 'Seções de Cronograma' }))
    expect(rail.getByRole('button', { name: 'Cronograma' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(
      rail.getByRole('button', { name: 'Plano salvo' }).getAttribute('aria-current'),
    ).toBeNull()
    await userEvent.click(rail.getByRole('button', { name: 'Marcos' }))
    expect(onSelect).toHaveBeenCalledWith('milestones')
  })

  it('com um só tópico não mostra o rail, mas mantém o conteúdo', () => {
    setup({ items: [ITEMS[0]!] })
    expect(screen.queryByRole('navigation', { name: 'Seções de Cronograma' })).toBeNull()
    expect(screen.getByText('Conteúdo da tela')).toBeTruthy()
  })

  it('mostra o subtítulo do tópico ativo', () => {
    setup({ activeId: 'milestones' })
    expect(
      screen.getByText('Acompanhe datas-chave de entrega ou aprovação ao longo do projeto.'),
    ).toBeTruthy()
  })
})

describe('Fluxo Preditivo: indicadores', () => {
  it('carrega o acompanhamento nos tópicos de cronograma', async () => {
    const { track } = setup({ activeId: 'schedule' })
    await screen.findByRole('region', { name: 'Indicadores do projeto' })
    expect(track).toHaveBeenCalledWith({ projectId: PROJECT_ID })
  })

  it('não mostra a faixa de indicadores na EAP', () => {
    setup({ activeId: 'wbs', items: [{ id: 'wbs', label: 'Entregas (EAP)' }] })
    expect(screen.queryByRole('region', { name: 'Indicadores do projeto' })).toBeNull()
  })
})
