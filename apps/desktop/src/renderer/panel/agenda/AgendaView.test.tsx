import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const addHour = (time: string) =>
  `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}${time.slice(2)}`

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
  occurrenceEndTime: addHour(time),
  retroActionsCount: 0,
  retroActionsDone: 0,
})

const M1 = meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M01', 'Planejamento da sprint', '2026-11-10')

const SERIES = {
  ...meeting('01J8Y4G2XK8Z1S6M3Q9W0A5S01', 'Alinhamento', '2026-10-26', '09:00'),
  recurrence: 'weekly' as const,
  recurrenceUntil: '2026-12-31',
}

/** Expande a série semanal (toda segunda) para o intervalo pedido, como o servidor faz. */
function weeklyIn(rangeStart: string, rangeEnd: string): MeetingOccurrenceDto[] {
  const out: MeetingOccurrenceDto[] = []
  for (let day = rangeStart; day <= rangeEnd; day = addDays(day, 1)) {
    const isMonday = new Date(`${day}T00:00:00Z`).getUTCDay() === 1
    if (isMonday && day >= SERIES.date)
      out.push({ ...SERIES, occurrenceDate: day, occurrenceIndex: 0 })
  }
  return out
}

type Source =
  | readonly MeetingOccurrenceDto[]
  | ((rangeStart: string, rangeEnd: string) => MeetingOccurrenceDto[])

function setup(
  role: 'manager' | 'collaborator',
  source: Source = [M1],
  upcoming: readonly MeetingOccurrenceDto[] = Array.isArray(source) ? source : [],
) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: role === 'manager' ? MANAGER : ANA,
    organizationId: ORG,
    role,
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(users)
  const list = vi
    .spyOn(api.meetings, 'list')
    .mockImplementation(({ rangeStart, rangeEnd }) =>
      Promise.resolve(typeof source === 'function' ? source(rangeStart, rangeEnd) : [...source]),
    )
  vi.spyOn(api.meetings, 'listUpcoming').mockResolvedValue([...upcoming])
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

  it('mostra uma série semanal em cada semana em que ela cai', async () => {
    const { user } = setup('manager', weeklyIn)
    // Semana de 26 de outubro a 1 de novembro: a série cai na segunda 26.
    const firstWeek = await screen.findByRole('button', {
      name: 'Alinhamento, Reunião, 09:00 às 10:00, repete toda semana',
    })
    expect(firstWeek).toBeTruthy()
    // Próxima semana: 2 a 8 de novembro, a mesma série aparece de novo na segunda 2.
    await user.click(screen.getByRole('button', { name: 'Próximo período' }))
    expect(
      await screen.findByRole('button', {
        name: 'Alinhamento, Reunião, 09:00 às 10:00, repete toda semana',
      }),
    ).toBeTruthy()
  })

  it('mostra a série semanal em dois meses no mês', async () => {
    const { user } = setup('manager', weeklyIn)
    await user.click(screen.getByRole('button', { name: 'Mês' }))
    const monday9 = await screen.findByRole('button', { name: /segunda-feira, 9 de novembro/i })
    expect(await within(monday9).findByText('09:00 Alinhamento', { selector: 'span' })).toBeTruthy()
    expect(within(monday9).getByRole('img', { name: 'Repete toda semana' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    const monday7 = await screen.findByRole('button', { name: /segunda-feira, 7 de dezembro/i })
    expect(await within(monday7).findByText('09:00 Alinhamento', { selector: 'span' })).toBeTruthy()
  })

  it('lista os Próximos com dia, horário em mono, tipo e recorrência', async () => {
    const review = {
      ...meeting('01J8Y4G2XK8Z1S6M3Q9W0A5R01', 'Revisão da entrega', '2026-11-10', '10:00'),
      kind: 'review' as const,
      endTime: '11:30',
      occurrenceEndTime: '11:30',
    }
    const weekly = { ...SERIES, occurrenceDate: '2026-11-02', occurrenceIndex: 1 }
    setup('manager', [review], [weekly, review])
    const upcoming = await screen.findByRole('region', { name: 'Próximos agendamentos' })
    const weeklyCard = within(upcoming).getByRole('button', { name: /Alinhamento/ })
    expect(within(weeklyCard).getByText('SEG')).toBeTruthy()
    expect(within(weeklyCard).getByText('02')).toBeTruthy()
    expect(within(weeklyCard).getByText('09:00')).toBeTruthy()
    expect(within(weeklyCard).getByText('Toda semana')).toBeTruthy()
    const reviewCard = within(upcoming).getByRole('button', { name: /Revisão da entrega/ })
    expect(within(reviewCard).getByText('10:00 – 11:30').className).toContain('mono')
    expect(within(reviewCard).getByText('Revisão')).toBeTruthy()
    expect(within(reviewCard).queryByText('Toda semana')).toBeNull()
  })
})

describe('Agenda: gestor', () => {
  it('cria um agendamento com tipo, fim e repetição semanal', async () => {
    const { api, user } = setup('manager')
    const create = vi.spyOn(api.meetings, 'create').mockResolvedValue(M1)
    await user.click(screen.getByRole('button', { name: 'Mês' }))
    await user.click(await screen.findByRole('button', { name: /sexta-feira, 20 de novembro/i }))
    await user.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    await user.type(await screen.findByLabelText('Título'), 'Revisão de sprint')
    expect(screen.getByLabelText<HTMLInputElement>('Data').value).toBe('2026-11-20')
    await user.click(screen.getByRole('button', { name: 'Revisão' }))
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '11:00' } })
    await user.click(screen.getByRole('checkbox', { name: 'Repetir toda semana' }))
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-12-31' } })
    await user.click(await screen.findByRole('checkbox', { name: 'Ana Souza' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        title: 'Revisão de sprint',
        date: '2026-11-20',
        time: '09:00',
        endTime: '11:00',
        kind: 'review',
        recurrence: 'weekly',
        recurrenceUntil: '2026-12-31',
        participants: [ANA],
      }),
    )
    await waitFor(() => expect(screen.queryByLabelText('Título')).toBeNull())
  })

  it('não salva com fim antes do início e mostra a mensagem', async () => {
    const { user } = setup('manager')
    await user.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    await user.type(await screen.findByLabelText('Título'), 'Retro')
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '08:30' } })
    expect(screen.getByText('O fim precisa ser depois do início.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '10:00' } })
    expect(screen.queryByText('O fim precisa ser depois do início.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(false)
  })

  it('valida a data final da repetição e mostra a dica quando ela está vazia', async () => {
    const { user } = setup('manager')
    await user.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    await user.type(await screen.findByLabelText('Título'), 'Alinhamento')
    await user.click(screen.getByRole('checkbox', { name: 'Repetir toda semana' }))
    expect(screen.getByText('Sem data final, repete por até 52 semanas.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-01' } })
    expect(screen.getByText('A data final precisa ser depois do início.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(true)
  })

  it('edita uma ocorrência de série abrindo a série inteira, com o aviso', async () => {
    const { api, user } = setup('manager', weeklyIn)
    const update = vi.spyOn(api.meetings, 'update').mockResolvedValue(M1)
    await user.click(await screen.findByRole('button', { name: /^Alinhamento, Reunião/ }))
    expect(await screen.findByText('Isso altera todas as repetições.')).toBeTruthy()
    const title = await screen.findByLabelText<HTMLInputElement>('Título')
    expect(title.value).toBe('Alinhamento')
    await user.clear(title)
    await user.type(title, 'Alinhamento de equipe')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        meetingId: SERIES.seriesId,
        changes: {
          title: 'Alinhamento de equipe',
          date: '2026-10-26',
          time: '09:00',
          endTime: null,
          kind: 'meeting',
          recurrence: 'weekly',
          recurrenceUntil: '2026-12-31',
          participants: [ANA],
        },
      }),
    )
  })

  it('exclui uma série só depois da confirmação inline com o aviso', async () => {
    const { api, user } = setup('manager', weeklyIn)
    const remove = vi.spyOn(api.meetings, 'delete').mockResolvedValue(undefined)
    await user.click(await screen.findByRole('button', { name: /^Alinhamento, Reunião/ }))
    await user.click(await screen.findByRole('button', { name: 'Excluir' }))
    expect(screen.getByText('Excluir esta série? Isso altera todas as repetições.')).toBeTruthy()
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Manter' }))
    expect(screen.queryByText('Excluir esta série? Isso altera todas as repetições.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    await user.click(screen.getByRole('button', { name: 'Excluir série' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ meetingId: SERIES.seriesId }))
  })

  it('exclui um agendamento avulso direto pelo item da lista', async () => {
    const { api, user } = setup('manager')
    const remove = vi.spyOn(api.meetings, 'delete').mockResolvedValue(undefined)
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
  it('vê todos os agendamentos da organização, mas não cria nem edita', async () => {
    setup('collaborator', weeklyIn)
    expect(await screen.findByText('Só o gestor cria e edita agendamentos.')).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Novo agendamento' }).disabled,
    ).toBe(true)
    const item = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Alinhamento, Reunião, 09:00 às 10:00, repete toda semana',
    })
    expect(item.disabled).toBe(true)
  })
})
