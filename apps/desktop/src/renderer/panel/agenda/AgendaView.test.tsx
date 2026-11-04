import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeetingOccurrenceDto, SessionUserDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { boardResponse, createFakeApi } from '../../shared/testing/fake-api'
import { AgendaView } from './AgendaView'

afterEach(cleanup)

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'

const users: SessionUserDto[] = [
  { id: MANAGER, name: 'Marta Gestora', initials: 'MG', role: 'manager', defaultRate: 80 },
  { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: null },
]

const meeting = (
  id: string,
  title: string,
  date: string,
  time = '10:00',
): MeetingOccurrenceDto => ({
  id,
  title,
  date,
  time,
  endTime: null,
  kind: 'meeting',
  recurrence: 'none',
  recurrenceUntil: null,
  participants: [ANA],
  createdBy: MANAGER,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
  seriesId: id,
  occurrenceDate: date,
  occurrenceIndex: 0,
  occurrenceEndTime: time,
})

const M1 = meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M01', 'Planejamento da sprint', '2026-11-10')

function setup(role: 'manager' | 'collaborator', month: MeetingOccurrenceDto[] = [M1]) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: role === 'manager' ? MANAGER : ANA,
    organizationId: ORG,
    role,
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(users)
  const list = vi.spyOn(api.meetings, 'list').mockResolvedValue(month)
  vi.spyOn(api.meetings, 'listUpcoming').mockResolvedValue(month)
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <AgendaView today="2026-11-01" />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, list, user: userEvent.setup() }
}

describe('Agenda: calendário', () => {
  it('mantém carregamento explícito e depois informa falha em vez de mostrar agenda vazia', async () => {
    const api = createFakeApi()
    let rejectList!: (reason: Error) => void
    const pending = new Promise<MeetingOccurrenceDto[]>((_resolve, reject) => {
      rejectList = reject
    })
    vi.spyOn(api.meetings, 'list').mockReturnValue(pending)
    vi.spyOn(api.meetings, 'listUpcoming').mockResolvedValue([])
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([]))
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <AgendaView today="2026-11-02" />
        </QueryProvider>
      </ApiProvider>,
    )
    expect(screen.getByRole('status', { name: 'Carregando agenda' })).toBeTruthy()
    rejectList(new Error('Sem conexão'))
    expect(await screen.findByText('Não foi possível carregar os agendamentos.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Agenda semanal' })).toBeNull()
  })

  it('começa em semana seg–dom, consulta os dois meses e navega também por dia', async () => {
    const { list, user } = setup('manager')
    expect(await screen.findByRole('region', { name: 'Agenda semanal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Semana' }).getAttribute('aria-pressed')).toBe('true')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith({ rangeStart: '2026-10-01', rangeEnd: '2026-10-31' }),
    )
    expect(list).toHaveBeenCalledWith({ rangeStart: '2026-11-01', rangeEnd: '2026-11-30' })
    await user.click(screen.getByRole('button', { name: 'Dia' }))
    expect(screen.getByRole('region', { name: 'Agenda diária' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Próximo período' }))
    expect(
      screen
        .getByRole('button', { name: /segunda-feira, 2 de novembro/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('mostra o mês, marca hoje e carrega os agendamentos do mês', async () => {
    const { list } = setup('manager')
    await userEvent.click(screen.getByRole('button', { name: 'Mês' }))
    expect(await screen.findByRole('heading', { name: /novembro de 2026/i })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /domingo, 1 de novembro/i }).getAttribute('aria-current'),
    ).toBe('date')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith({ rangeStart: '2026-11-01', rangeEnd: '2026-11-30' }),
    )
    expect(
      await screen.findByText('10:00 Planejamento da sprint', { selector: 'span' }),
    ).toBeTruthy()
  })

  it('navega entre meses e vira o ano', async () => {
    const { list, user } = setup('manager')
    await user.click(screen.getByRole('button', { name: 'Mês' }))
    await screen.findByRole('heading', { name: /novembro de 2026/i })
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByRole('heading', { name: /janeiro de 2027/i })).toBeTruthy()
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ rangeStart: '2027-01-01', rangeEnd: '2027-01-31' }),
    )
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(await screen.findByRole('heading', { name: /dezembro de 2026/i })).toBeTruthy()
  })

  it('seleciona o dia, move pelo teclado e não abre o formulário', async () => {
    const { user } = setup('manager')
    await user.click(screen.getByRole('button', { name: 'Mês' }))
    const day = await screen.findByRole('button', { name: /terça-feira, 10 de novembro/i })
    await user.click(day)
    expect(day.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('form')).toBeNull()
    day.focus()
    await user.keyboard('{ArrowRight}')
    expect(
      screen
        .getByRole('button', { name: /quarta-feira, 11 de novembro/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    await user.keyboard('{ArrowDown}')
    expect(
      screen
        .getByRole('button', { name: /quarta-feira, 18 de novembro/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('mostra até 2 eventos e "+N mais"', async () => {
    setup('manager', [
      meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M01', 'A', '2026-11-10', '08:00'),
      meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M02', 'B', '2026-11-10', '09:00'),
      meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M03', 'C', '2026-11-10', '10:00'),
      meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M04', 'D', '2026-11-10', '11:00'),
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Mês' }))
    const day = await screen.findByRole('button', { name: /terça-feira, 10 de novembro/i })
    expect(await within(day).findByText('+2 mais')).toBeTruthy()
    expect(within(day).queryByText(/10:00 C/)).toBeNull()
  })
})

describe('Agenda: gestor', () => {
  it('cria um agendamento com a data do dia selecionado', async () => {
    const { api, user } = setup('manager')
    const create = vi.spyOn(api.meetings, 'create').mockResolvedValue(M1)
    await user.click(screen.getByRole('button', { name: 'Mês' }))
    await user.click(await screen.findByRole('button', { name: /sexta-feira, 20 de novembro/i }))
    await user.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    await user.type(await screen.findByLabelText('Título'), 'Retrospectiva')
    expect(screen.getByLabelText<HTMLInputElement>('Data').value).toBe('2026-11-20')
    await user.click(await screen.findByRole('checkbox', { name: 'Ana Souza' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        title: 'Retrospectiva',
        date: '2026-11-20',
        time: '09:00',
        participants: [ANA],
      }),
    )
    await waitFor(() => expect(screen.queryByLabelText('Título')).toBeNull())
  })

  it('edita e exclui pelo item da lista', async () => {
    const { api, user } = setup('manager')
    const update = vi.spyOn(api.meetings, 'update').mockResolvedValue(M1)
    const remove = vi.spyOn(api.meetings, 'delete').mockResolvedValue(undefined)
    await user.click(await screen.findByRole('button', { name: /Planejamento da sprint/ }))
    const title = await screen.findByLabelText<HTMLInputElement>('Título')
    expect(title.value).toBe('Planejamento da sprint')
    await user.clear(title)
    await user.type(title, 'Planejamento v2')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        meetingId: M1.id,
        changes: {
          title: 'Planejamento v2',
          date: '2026-11-10',
          time: '10:00',
          participants: [ANA],
        },
      }),
    )
    await user.click(await screen.findByRole('button', { name: /Planejamento da sprint/ }))
    await user.click(await screen.findByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ meetingId: M1.id }))
  })

  it('mostra "Nada marcado." sem agendamentos', async () => {
    setup('manager', [])
    expect(await screen.findByText('Nada marcado.')).toBeTruthy()
  })
})

describe('Agenda: colaborador', () => {
  it('vê os agendamentos, mas não cria nem edita', async () => {
    setup('collaborator')
    expect(await screen.findByText('Só o gestor cria e edita agendamentos.')).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Novo agendamento' }).disabled,
    ).toBe(true)
    const item = await screen.findByRole<HTMLButtonElement>('button', {
      name: /Planejamento da sprint/,
    })
    expect(item.disabled).toBe(true)
  })
})
