import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeetingOccurrenceDto, SessionUserDto, TaskDto } from '@agilebox/contract'
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

interface BoardSource {
  /** Tarefas em que a pessoa participa (listBoard). */
  readonly own?: readonly TaskDto[]
  /** Tarefas da organização para o gestor (listTeamBoard). */
  readonly team?: readonly TaskDto[]
}

function setup(
  role: 'manager' | 'collaborator',
  source: Source = [M1],
  upcoming: readonly MeetingOccurrenceDto[] = Array.isArray(source) ? source : [],
  board: BoardSource = {},
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
  const listBoard = vi
    .spyOn(api.tasks, 'listBoard')
    .mockResolvedValue(boardResponse([...(board.own ?? [])]))
  const listTeamBoard = vi
    .spyOn(api.tasks, 'listTeamBoard')
    .mockResolvedValue([...(board.team ?? [])])
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <AgendaView today="2026-11-01" />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, list, listBoard, listTeamBoard, user: userEvent.setup() }
}

const D1 = meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M11', 'Daily da equipe', '2026-11-03', '09:30')
const D2 = meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M12', 'Alinhamento de entrega', '2026-11-03', '14:00')
const D3 = meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M13', 'Revisão geral', '2026-11-03', '16:00')

describe('Agenda: cabeçalho', () => {
  it('gestor vê título, subtítulo e "+ Novo agendamento"', async () => {
    setup('manager')
    expect(await screen.findByRole('heading', { level: 1, name: 'Agenda' })).toBeTruthy()
    expect(
      screen.getByText('Alinhamentos, entregas e combinados da equipe sem cortar o fim de semana.'),
    ).toBeTruthy()
    expect(await screen.findByRole('button', { name: '+ Novo agendamento' })).toBeTruthy()
    expect(screen.queryByText('Somente leitura')).toBeNull()
  })

  it('colaborador vê o selo "Somente leitura" e não vê o botão de criar', async () => {
    setup('collaborator')
    expect(await screen.findByText('Somente leitura')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ Novo agendamento' })).toBeNull()
  })
})

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
    expect(screen.queryByRole('group', { name: 'Agenda semanal' })).toBeNull()
  })

  it('começa na semana seg–dom, consulta os dois meses e mostra a legenda', async () => {
    const { list } = setup('manager')
    const week = await screen.findByRole('group', { name: 'Agenda semanal' })
    expect(screen.getByRole('button', { name: 'Semana' }).getAttribute('aria-pressed')).toBe('true')
    expect(
      screen.getByRole('heading', { name: '26 de outubro – 1 de novembro de 2026' }),
    ).toBeTruthy()
    expect(within(week).getAllByText('Livre')).toHaveLength(7)
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith({ rangeStart: '2026-10-01', rangeEnd: '2026-10-31' }),
    )
    expect(list).toHaveBeenCalledWith({ rangeStart: '2026-11-01', rangeEnd: '2026-11-30' })
    const legend = screen.getByLabelText('Categorias de eventos')
    for (const name of ['Daily', 'Planejamento', 'Retrospectiva', 'Entrega'])
      expect(within(legend).getByText(name)).toBeTruthy()
  })

  it('navega por período e volta com Hoje', async () => {
    const { user } = setup('manager')
    await user.click(await screen.findByRole('button', { name: 'Próximo período' }))
    expect(screen.getByRole('heading', { name: '2 – 8 de novembro de 2026' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(
      screen.getByRole('heading', { name: '26 de outubro – 1 de novembro de 2026' }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Dia' }))
    expect(screen.getByRole('heading', { name: 'Domingo, 1 de novembro de 2026' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Período anterior' }))
    expect(screen.getByRole('heading', { name: 'Sábado, 31 de outubro de 2026' })).toBeTruthy()
  })

  it('mostra o evento na semana com horário e título', async () => {
    setup('manager', [D1])
    const week = await screen.findByRole('group', { name: 'Agenda semanal' })
    expect(within(week).queryByText('Daily da equipe')).toBeNull()
    cleanup()
    const { user } = setup('manager', [D1])
    await user.click(await screen.findByRole('button', { name: 'Próximo período' }))
    const next = await screen.findByRole('group', { name: 'Agenda semanal' })
    const pill = await within(next).findByRole('button', { name: /Daily da equipe/ })
    expect(pill.textContent).toContain('09:30')
  })

  it('visão Dia mostra o estado vazio e a lista do dia', async () => {
    const { user } = setup('manager', [D1])
    await user.click(await screen.findByRole('button', { name: 'Dia' }))
    expect(await screen.findByText('Nenhum agendamento em 1 de novembro')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Próximo período' }))
    await user.click(screen.getByRole('button', { name: 'Próximo período' }))
    const row = (await screen.findAllByRole('button', { name: /Daily da equipe/ }))[0]!
    expect(row.textContent).toContain('09:30')
    expect(row.textContent).toContain('Daily')
  })

  it('visão Mês mostra "HH:MM Título", até 2 chips e "+N mais"', async () => {
    const { user } = setup('manager', [D1, D2, D3])
    await user.click(await screen.findByRole('button', { name: 'Mês' }))
    expect(screen.getByRole('heading', { name: 'Novembro de 2026' })).toBeTruthy()
    const month = await screen.findByRole('group', { name: 'Agenda mensal' })
    expect(within(month).getByRole('button', { name: '09:30 Daily da equipe' })).toBeTruthy()
    expect(within(month).getByRole('button', { name: '14:00 Alinhamento de entrega' })).toBeTruthy()
    expect(within(month).queryByRole('button', { name: /Revisão geral/ })).toBeNull()
    expect(within(month).getByText('+1 mais')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Próximo período' }))
    expect(screen.getByRole('heading', { name: 'Dezembro de 2026' })).toBeTruthy()
  })

  it('mostra a série semanal em cada semana em que ela cai', async () => {
    const { user } = setup('manager', weeklyIn)
    const week = await screen.findByRole('group', { name: 'Agenda semanal' })
    expect(within(week).getAllByRole('button', { name: /Alinhamento/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Próximo período' }))
    expect(
      within(await screen.findByRole('group', { name: 'Agenda semanal' })).getAllByRole('button', {
        name: /Alinhamento/,
      }),
    ).toHaveLength(1)
  })
})

describe('Agenda: Próximos 7 dias', () => {
  it('lista dia, horário e categoria em mono e conta os eventos', async () => {
    setup('manager', [D1], [D1, M1])
    const section = await screen.findByRole('region', { name: 'Próximos 7 dias' })
    expect(await within(section).findByText('1 evento')).toBeTruthy()
    expect(within(section).getByText('3 de novembro')).toBeTruthy()
    expect(within(section).getByText('09:30 · Daily')).toBeTruthy()
    expect(within(section).queryByText(/Planejamento da sprint/)).toBeNull()
  })

  it('mostra Hoje e Amanhã e o estado vazio', async () => {
    const today = meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M21', 'Hoje cedo', '2026-11-01')
    const tomorrow = meeting('01J8Y4G2XK8Z1S6M3Q9W0A5M22', 'Amanhã cedo', '2026-11-02')
    setup('manager', [], [today, tomorrow])
    const section = await screen.findByRole('region', { name: 'Próximos 7 dias' })
    expect(await within(section).findByText('Hoje')).toBeTruthy()
    expect(within(section).getByText('Amanhã')).toBeTruthy()
    expect(within(section).getByText('2 eventos')).toBeTruthy()
    cleanup()
    setup('manager', [], [])
    expect(await screen.findByText('Nenhum compromisso nos próximos 7 dias.')).toBeTruthy()
  })
})

describe('Agenda: modal de agendamento', () => {
  it('o gestor cria com categoria, fim e repetição semanal', async () => {
    const { api, user } = setup('manager')
    const create = vi.spyOn(api.meetings, 'create').mockResolvedValue(M1)
    await user.click(await screen.findByRole('button', { name: '+ Novo agendamento' }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo agendamento' })
    await user.type(within(dialog).getByLabelText('Título do encontro'), 'Entrega de sprint')
    expect(within(dialog).getByLabelText<HTMLInputElement>('Data').value).toBe('2026-11-01')
    await user.selectOptions(within(dialog).getByLabelText('Categoria'), 'Entrega')
    fireEvent.change(within(dialog).getByLabelText('Fim (opcional)'), {
      target: { value: '11:00' },
    })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Repetir toda semana' }))
    fireEvent.change(within(dialog).getByLabelText('Até'), { target: { value: '2026-12-31' } })
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Ana Souza' }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar agendamento' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        title: 'Entrega de sprint',
        date: '2026-11-01',
        time: '10:00',
        endTime: '11:00',
        kind: 'review',
        recurrence: 'weekly',
        recurrenceUntil: '2026-12-31',
        participants: [ANA],
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('não salva com fim antes do início e valida a data final da repetição', async () => {
    const { user } = setup('manager')
    await user.click(await screen.findByRole('button', { name: '+ Novo agendamento' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título do encontro'), 'X')
    fireEvent.change(within(dialog).getByLabelText('Fim (opcional)'), {
      target: { value: '09:00' },
    })
    expect(within(dialog).getByText('O fim precisa ser depois do início.')).toBeTruthy()
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Salvar agendamento' })
        .disabled,
    ).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Fim (opcional)'), { target: { value: '' } })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Repetir toda semana' }))
    expect(within(dialog).getByText('Sem data final, repete por até 52 semanas.')).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText('Até'), { target: { value: '2026-10-01' } })
    expect(within(dialog).getByText('A data final precisa ser depois do início.')).toBeTruthy()
  })

  it('edita uma ocorrência de série abrindo a série inteira, com o aviso', async () => {
    const { api, user } = setup('manager', weeklyIn)
    const update = vi.spyOn(api.meetings, 'update').mockResolvedValue(SERIES)
    const week = await screen.findByRole('group', { name: 'Agenda semanal' })
    await user.click(within(week).getByRole('button', { name: /Alinhamento/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalhes do agendamento' })
    expect(within(dialog).getByText('Isso altera todas as repetições.')).toBeTruthy()
    expect(within(dialog).getByLabelText<HTMLInputElement>('Data').value).toBe('2026-10-26')
    await user.clear(within(dialog).getByLabelText('Título do encontro'))
    await user.type(within(dialog).getByLabelText('Título do encontro'), 'Alinhamento semanal')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar agendamento' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        meetingId: SERIES.id,
        changes: {
          title: 'Alinhamento semanal',
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

  it('exclui uma série só depois da confirmação inline', async () => {
    const { api, user } = setup('manager', weeklyIn)
    const del = vi.spyOn(api.meetings, 'delete').mockResolvedValue(undefined)
    const week = await screen.findByRole('group', { name: 'Agenda semanal' })
    await user.click(within(week).getByRole('button', { name: /Alinhamento/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    expect(del).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Excluir série' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith({ meetingId: SERIES.id }))
  })

  it('exclui um agendamento avulso direto pelo botão Excluir', async () => {
    const { api, user } = setup('manager', [D1], [D1])
    const del = vi.spyOn(api.meetings, 'delete').mockResolvedValue(undefined)
    const section = await screen.findByRole('region', { name: 'Próximos 7 dias' })
    await user.click(await within(section).findByRole('button', { name: /Daily da equipe/ }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }),
    )
    await waitFor(() => expect(del).toHaveBeenCalledWith({ meetingId: D1.id }))
  })

  it('o colaborador só visualiza: campos desabilitados, sem salvar nem excluir', async () => {
    const { user } = setup('collaborator', [D1], [D1])
    const section = await screen.findByRole('region', { name: 'Próximos 7 dias' })
    await user.click(await within(section).findByRole('button', { name: /Daily da equipe/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Visualizar agendamento' })
    expect(within(dialog).getByLabelText<HTMLInputElement>('Título do encontro').disabled).toBe(
      true,
    )
    expect(within(dialog).getByLabelText<HTMLSelectElement>('Categoria').value).toBe('Daily')
    expect(within(dialog).queryByRole('button', { name: 'Salvar agendamento' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Excluir' })).toBeNull()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('Agenda: prazos de tarefas por perfil', () => {
  const PROJECT = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'
  const MINE_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5K01'
  const TEAM_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5K02'

  const makeDeadlineTask = (id: string, key: string, title: string, deadline: string): TaskDto => ({
    id,
    number: Number(key.slice(3)),
    key,
    projectId: PROJECT,
    projectName: 'Projeto Aurora',
    title,
    description: '',
    status: 'in_progress',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    deadline,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    checklistProgress: { done: 0, total: 0, percent: 0 },
    commentCount: 0,
  })

  const mine = makeDeadlineTask(MINE_ID, 'AB-118', 'Minha tarefa', '2026-10-30')
  const others = makeDeadlineTask(TEAM_ID, 'AB-119', 'Relatório mensal', '2026-10-28')

  it('o gestor vê prazos de tarefas de outras pessoas e não repete as próprias', async () => {
    const { listBoard, listTeamBoard } = setup('manager', [], [], {
      own: [mine],
      team: [mine, others],
    })
    expect(
      await screen.findByRole('button', { name: 'Abrir tarefa: Relatório mensal' }),
    ).toBeTruthy()
    expect(listBoard).toHaveBeenCalledWith({})
    expect(listTeamBoard).toHaveBeenCalledWith({})
    expect(screen.getAllByRole('button', { name: 'Abrir tarefa: Minha tarefa' })).toHaveLength(1)
  })

  it('o colaborador vê só os prazos das tarefas de que participa', async () => {
    const { listBoard, listTeamBoard } = setup('collaborator', [], [], {
      own: [mine],
      team: [mine, others],
    })
    expect(await screen.findByRole('button', { name: 'Abrir tarefa: Minha tarefa' })).toBeTruthy()
    expect(listBoard).toHaveBeenCalledWith({})
    expect(listTeamBoard).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Abrir tarefa: Relatório mensal' })).toBeNull()
  })
})
