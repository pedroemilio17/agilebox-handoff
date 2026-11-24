import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RiskListItemDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { deliverableRow, wbsId, wbsView } from '../wbs/wbs-fixtures'
import { RisksView } from './RisksView'

const PROJECT = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function risk(overrides: Partial<RiskListItemDto> & Pick<RiskListItemDto, 'id' | 'title'>) {
  return {
    projectId: PROJECT,
    description: null,
    probability: 3,
    impact: 3,
    response: null,
    ownerId: null,
    ownerName: null,
    deliverableId: null,
    deliverableTitle: null,
    status: 'open',
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  } satisfies RiskListItemDto
}

const RISKS: RiskListItemDto[] = [
  risk({ id: '01J8Y4G2XK8Z1S6M3Q9W0RISK1', title: 'Fornecedor atrasa', probability: 3, impact: 3 }),
  risk({
    id: '01J8Y4G2XK8Z1S6M3Q9W0RISK2',
    title: 'Chuva afeta visita',
    probability: 1,
    impact: 1,
  }),
]

function setup(risks: readonly RiskListItemDto[]) {
  const api = createFakeApi()
  vi.spyOn(api.risks, 'list').mockResolvedValue({
    projectId: PROJECT,
    canEdit: false,
    risks: [...risks],
  })
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([])
  vi.spyOn(api.wbs, 'get').mockResolvedValue(
    wbsView([deliverableRow(wbsId('21'), { code: '2.1', title: 'Infraestrutura' })]),
  )
  renderPanel(<RisksView projectId={PROJECT} projectName="Projeto Aurora" />, { api })
}

function listTitles() {
  const list = screen.queryByRole('list', { name: 'Lista de riscos' })
  return list
    ? within(list)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent)
    : []
}

describe('matriz 3×3 filtra a lista de riscos', () => {
  it('mostra a matriz com os riscos e a lista completa por padrão', async () => {
    setup(RISKS)
    expect(await screen.findByRole('region', { name: 'Matriz de riscos' })).toBeTruthy()
    expect(listTitles()).toEqual(['Fornecedor atrasa', 'Chuva afeta visita'])
  })

  it('clicar num quadrante mostra só os riscos dele; "Mostrar todos" volta', async () => {
    setup(RISKS)
    await screen.findByRole('region', { name: 'Matriz de riscos' })
    await userEvent.click(screen.getByRole('button', { name: /Probabilidade Alta, impacto Alto/ }))
    expect(listTitles()).toEqual(['Fornecedor atrasa'])

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar todos (2)' }))
    expect(listTitles()).toEqual(['Fornecedor atrasa', 'Chuva afeta visita'])
  })

  it('quadrante vazio mostra a mensagem em vez de uma lista vazia', async () => {
    setup(RISKS)
    await screen.findByRole('region', { name: 'Matriz de riscos' })
    await userEvent.click(
      screen.getByRole('button', { name: /Probabilidade Média, impacto Médio/ }),
    )
    expect(screen.getByText('Nenhum risco neste quadrante.')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Lista de riscos' })).toBeNull()
  })
})
