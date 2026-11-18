import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { UpdatesView } from './UpdatesView'
import { CHAMADOS, dashboardFixture, insightsFixture } from './dashboard-fixtures'

afterEach(cleanup)

function setup() {
  const api = createFakeApi()
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboardFixture(insightsFixture()))
  const onOpenTask = vi.fn()
  const onOpenProject = vi.fn()
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <UpdatesView onOpenTask={onOpenTask} onOpenProject={onOpenProject} />
      </QueryProvider>
    </ApiProvider>,
  )
  return { user: userEvent.setup(), onOpenTask, onOpenProject }
}

describe('Atualizações (tela 20)', () => {
  it('abre na visão Exige ação, com os sinais e o texto de apoio do desenho', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'Atualizações' })).toBeTruthy()
    expect(screen.getByText('3 de 3 nesta semana · visão Exige ação')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Exige ação/ }).getAttribute('aria-current')).toBe(
      'page',
    )
    // Sinal com hora (WIP, aceite) cai no dia dele; o marco, sem hora, fica em "Em aberto".
    const today = screen.getByRole('region', { name: 'Hoje' })
    expect(within(today).getByText('Desenvolvendo está com 4 de 3.')).toBeTruthy()
    const open = screen.getByRole('region', { name: 'Em aberto' })
    expect(within(open).getByText(/Integração bancária/)).toBeTruthy()
    expect(screen.getByText(/junta o que só você resolve/)).toBeTruthy()
  })

  it('filtros de tipo, projeto e pessoa com contagens; "Mostrar minhas edições" começa desligado', async () => {
    const { user } = setup()
    await screen.findByText('Visões')
    expect(screen.getByRole('checkbox', { name: /WIP e paradas/ })).toBeTruthy()
    expect(
      screen.getByRole('checkbox', { name: 'Mostrar minhas edições' }).hasAttribute('checked'),
    ).toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Agrupar por tarefa' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Marcos e prazos/ }))
    // Marco em risco (sinal) aparece; a edição de prazo do gestor (Bruno, marcada Gestor) fica de fora.
    expect(screen.getByText('1 de 3 nesta semana · visão Marcos e prazos')).toBeTruthy()
    await user.click(screen.getByRole('checkbox', { name: 'Mostrar minhas edições' }))
    expect(screen.getByText('2 de 3 nesta semana · visão Marcos e prazos')).toBeTruthy()
    expect(screen.getByText('Gestor')).toBeTruthy()
  })

  it('"Tudo de hoje" lista só os movimentos do dia e agrupa por tarefa', async () => {
    const { user } = setup()
    await screen.findByText('Visões')
    await user.click(screen.getByRole('button', { name: /Tudo de hoje/ }))
    // "Mudança de estado" começa desmarcada, como no desenho: só a estimativa aparece.
    expect(screen.getByText('1 de 3 nesta semana · visão Tudo de hoje')).toBeTruthy()
    await user.click(screen.getByRole('checkbox', { name: /Mudança de estado/ }))
    expect(screen.getByText('2 de 3 nesta semana · visão Tudo de hoje')).toBeTruthy()
    // As duas edições da mesma tarefa caem em uma linha; a segunda aparece na lista de apoio.
    const grouped = screen.getByRole('region', { name: 'Hoje' })
    expect(within(grouped).getAllByRole('article')).toHaveLength(1)
    expect(within(grouped).getByText(/moveu de A fazer para Desenvolvendo/)).toBeTruthy()
  })

  it('desligar um tipo tira a linha da lista, e a contagem do tipo continua', async () => {
    const { user } = setup()
    const wip = await screen.findByRole('checkbox', { name: /WIP e paradas/ })
    await user.click(wip)
    expect(screen.queryByText('Desenvolvendo está com 4 de 3.')).toBeNull()
    expect(screen.getByRole('checkbox', { name: /WIP e paradas/ })).toBeTruthy()
  })

  it('o botão de cada linha leva à tela certa', async () => {
    const { user, onOpenProject, onOpenTask } = setup()
    const today = await screen.findByRole('region', { name: 'Hoje' })
    await user.click(within(today).getByRole('button', { name: 'Ver quadro' }))
    expect(onOpenProject).toHaveBeenCalledWith(CHAMADOS, 'board')
    await user.click(within(today).getByRole('button', { name: 'Revisar' }))
    expect(onOpenTask).toHaveBeenCalledWith('01HZTASKAB140000000000000')
  })

  it('tipos começam marcados como no desenho: estado e comentários de fora', async () => {
    setup()
    expect(
      (await screen.findByRole('checkbox', { name: /Aceite pendente/ })).hasAttribute('checked'),
    ).toBe(true)
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: /Mudança de estado/ }).checked,
    ).toBe(false)
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Comentários/ }).checked).toBe(
      false,
    )
  })

  it('botões do desenho sem dado no backend ficam visíveis e desabilitados', async () => {
    setup()
    expect(
      (await screen.findByRole('button', { name: 'Marcar como vistas' })).hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Salvar como visão' }).hasAttribute('disabled')).toBe(
      true,
    )
  })
})
