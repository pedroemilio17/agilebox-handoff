import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeetingOccurrenceDto, RetroActionDto, SessionUserDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { boardResponse, createFakeApi } from '../../shared/testing/fake-api'
import { AgendaView } from './AgendaView'

afterEach(cleanup)

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const RETRO_SERIES = '01J8Y4G2XK8Z1S6M3Q9W0ARET1'
const RETRO_DATE = '2026-11-06'
const NEXT_RETRO_DATE = '2026-11-13'

const users: SessionUserDto[] = [
  { id: MANAGER, name: 'Marta Gestora', initials: 'MG', role: 'manager', defaultRate: 80 },
  { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: null },
]

const addHour = (time: string) =>
  `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}${time.slice(2)}`

function occurrence(
  seriesId: string,
  title: string,
  date: string,
  overrides: Partial<MeetingOccurrenceDto> = {},
): MeetingOccurrenceDto {
  return {
    id: seriesId,
    title,
    date,
    time: '09:00',
    endTime: null,
    kind: 'meeting',
    recurrence: 'none',
    recurrenceUntil: null,
    participants: [ANA],
    createdBy: MANAGER,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    seriesId,
    occurrenceDate: date,
    occurrenceIndex: 0,
    occurrenceEndTime: addHour('09:00'),
    retroActionsCount: 0,
    retroActionsDone: 0,
    ...overrides,
  }
}

const retro = (
  date = RETRO_DATE,
  overrides: Partial<MeetingOccurrenceDto> = {},
): MeetingOccurrenceDto =>
  occurrence(RETRO_SERIES, 'Retrospectiva da sprint', date, {
    kind: 'retro',
    retroActionsCount: 3,
    retroActionsDone: 2,
    ...overrides,
  })

function action(
  id: string,
  title: string,
  overrides: Partial<RetroActionDto> = {},
): RetroActionDto {
  return {
    id,
    meetingId: RETRO_SERIES,
    occurrenceDate: RETRO_DATE,
    title,
    responsibleId: ANA,
    responsibleName: 'Ana Souza',
    dueDate: null,
    done: false,
    doneAt: null,
    createdAt: '2026-11-02T12:00:00.000Z',
    createdBy: MANAGER,
    canManage: false,
    canToggle: true,
    ...overrides,
  }
}

const A1 = '01J8Y4G2XK8Z1S6M3Q9W0AAA01'
const A2 = '01J8Y4G2XK8Z1S6M3Q9W0AAA02'
const A3 = '01J8Y4G2XK8Z1S6M3Q9W0AAA03'

const sample = (): RetroActionDto[] => [
  action(A1, 'Revisar fluxo de aprovação', { done: true, doneAt: '2026-11-05T10:00:00.000Z' }),
  action(A2, 'Dividir tarefas grandes', {
    responsibleId: MANAGER,
    responsibleName: 'Marta Gestora',
    done: true,
    doneAt: '2026-11-05T11:00:00.000Z',
    canToggle: true,
  }),
  action(A3, 'Escrever checklist de release', {
    responsibleId: null,
    responsibleName: null,
    dueDate: '2026-10-30',
    canToggle: true,
  }),
]

interface SetupOptions {
  readonly role: 'manager' | 'collaborator'
  readonly meetings?: readonly MeetingOccurrenceDto[]
  readonly upcoming?: readonly MeetingOccurrenceDto[]
  readonly lists?: Record<string, RetroActionDto[]>
  readonly retroList?: (occurrenceDate: string) => Promise<RetroActionDto[]>
}

function setup({
  role,
  meetings = [retro()],
  upcoming = meetings,
  lists = { [RETRO_DATE]: sample() },
  retroList,
}: SetupOptions) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: role === 'manager' ? MANAGER : ANA,
    organizationId: ORG,
    role,
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(users)
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([]))
  vi.spyOn(api.meetings, 'list').mockImplementation(() => Promise.resolve([...meetings]))
  vi.spyOn(api.meetings, 'listUpcoming').mockResolvedValue([...upcoming])
  const listSpy = vi
    .spyOn(api.meetings.retroActions, 'list')
    .mockImplementation(({ occurrenceDate }) =>
      retroList ? retroList(occurrenceDate) : Promise.resolve([...(lists[occurrenceDate] ?? [])]),
    )
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <AgendaView today="2026-11-01" />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, listSpy, user: userEvent.setup() }
}

/** Abre a retro pelo cartão de Próximos (qualquer pessoa que vê a agenda consegue). */
async function openRetro(
  user: ReturnType<typeof userEvent.setup>,
  name = /Retrospectiva da sprint/,
) {
  const upcoming = await screen.findByRole('region', { name: 'Próximos agendamentos' })
  await user.click(within(upcoming).getAllByRole('button', { name })[0]!)
  return screen.findByRole('region', { name: 'Combinados' })
}

describe('Combinados: aparecem só em Retro', () => {
  it('não mostra a seção para reunião e mostra para retro', async () => {
    const meetingItem = occurrence(
      '01J8Y4G2XK8Z1S6M3Q9W0AMEET',
      'Planejamento da sprint',
      '2026-11-10',
    )
    const { user } = setup({ role: 'manager', meetings: [meetingItem, retro()] })
    await user.click(await screen.findByRole('button', { name: /Planejamento da sprint/ }))
    expect(await screen.findByRole('form', { name: 'Salvar' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Combinados' })).toBeNull()
    expect(await openRetro(user)).toBeTruthy()
  })

  it('colaborador abre a retro para ver os combinados, mas não a reunião', async () => {
    const meetingItem = occurrence(
      '01J8Y4G2XK8Z1S6M3Q9W0AMEET',
      'Planejamento da sprint',
      '2026-11-10',
    )
    const { user } = setup({ role: 'collaborator', meetings: [meetingItem, retro()] })
    const upcoming = await screen.findByRole('region', { name: 'Próximos agendamentos' })
    expect(
      within(upcoming)
        .getByRole('button', { name: /Planejamento da sprint/ })
        .hasAttribute('disabled'),
    ).toBe(true)
    await user.click(within(upcoming).getByRole('button', { name: /Retrospectiva da sprint/ }))
    expect(await screen.findByRole('region', { name: 'Combinados' })).toBeTruthy()
  })

  it('abre a retro pelo mês, no dia escolhido', async () => {
    const { user } = setup({ role: 'collaborator' })
    await user.click(screen.getByRole('button', { name: 'Mês' }))
    await user.click(await screen.findByRole('button', { name: /sexta-feira, 6 de novembro/i }))
    expect(await screen.findByRole('region', { name: 'Combinados' })).toBeTruthy()
  })
})

describe('Combinados: lista, contagem e progresso', () => {
  it('mostra "2 de 3 feitos", a barra de progresso e responsável ou "Sem responsável"', async () => {
    setup({ role: 'collaborator' })
    const section = await openRetro(userEvent.setup())
    expect(within(section).getByText('2 de 3 feitos')).toBeTruthy()
    const bar = within(section).getByRole('progressbar', { name: 'Combinados feitos' })
    expect(bar.getAttribute('aria-valuetext')).toBe('2 de 3')
    expect(within(section).getByText('Marta Gestora')).toBeTruthy()
    expect(within(section).getByText('Sem responsável')).toBeTruthy()
  })

  it('marca o prazo vencido e não feito com o texto "atrasado", em mono', async () => {
    setup({ role: 'collaborator' })
    const section = await openRetro(userEvent.setup())
    const overdue = within(section).getByText('30/10/2026')
    // A fonte mono fica no contêiner do prazo, que também abriga o rótulo "atrasado".
    expect(overdue.parentElement?.className).toMatch(/due/)
    expect(within(section).getByText('atrasado')).toBeTruthy()
    expect(within(section).getAllByText('atrasado')).toHaveLength(1)
  })

  it('mostra o estado vazio quando não há combinados', async () => {
    setup({ role: 'collaborator', lists: { [RETRO_DATE]: [] } })
    const section = await openRetro(userEvent.setup())
    expect(within(section).getByText('Nenhum combinado ainda.')).toBeTruthy()
  })

  it('mostra carregando enquanto a lista não chega', async () => {
    setup({ role: 'collaborator', retroList: () => new Promise(() => undefined) })
    const upcoming = await screen.findByRole('region', { name: 'Próximos agendamentos' })
    await userEvent.setup().click(within(upcoming).getByRole('button', { name: /Retrospectiva/ }))
    expect(await screen.findByText('Carregando combinados')).toBeTruthy()
  })

  it('mostra erro de carregamento no painel', async () => {
    setup({ role: 'collaborator', retroList: () => Promise.reject(new Error('Sem conexão')) })
    const section = await openRetro(userEvent.setup())
    expect(await within(section).findByRole('alert')).toBeTruthy()
    expect(within(section).getByText('Não foi possível carregar os combinados.')).toBeTruthy()
  })

  it('mostra a leitura somente para quem não gerencia, sem editar nem remover', async () => {
    setup({ role: 'collaborator' })
    const section = await openRetro(userEvent.setup())
    expect(
      within(section).getByText('Somente leitura: só o gestor cria e edita combinados.'),
    ).toBeTruthy()
    expect(within(section).queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Remover' })).toBeNull()
    expect(screen.queryByRole('form', { name: 'Adicionar combinado' })).toBeNull()
  })
})

describe('Combinados: marcar como feito', () => {
  it('a responsável marca o próprio combinado', async () => {
    const { api, user } = setup({ role: 'collaborator' })
    const toggle = vi.spyOn(api.meetings.retroActions, 'toggle').mockResolvedValue(action(A1, ''))
    const section = await openRetro(user)
    await user.click(
      within(section).getByRole('checkbox', {
        name: 'Marcar Escrever checklist de release como feito',
      }),
    )
    await waitFor(() => expect(toggle).toHaveBeenCalledWith({ actionId: A3, done: true }))
  })

  it('o gestor marca qualquer combinado', async () => {
    const { api, user } = setup({
      role: 'manager',
      lists: {
        [RETRO_DATE]: [
          action(A1, 'Revisar fluxo de aprovação', { canToggle: true, responsibleId: ANA }),
        ],
      },
    })
    const toggle = vi.spyOn(api.meetings.retroActions, 'toggle').mockResolvedValue(action(A1, ''))
    const section = await openRetro(user)
    await user.click(
      within(section).getByRole('checkbox', {
        name: 'Marcar Revisar fluxo de aprovação como feito',
      }),
    )
    await waitFor(() => expect(toggle).toHaveBeenCalledWith({ actionId: A1, done: true }))
  })

  it('bloqueia quem não é responsável nem gestor', async () => {
    setup({
      role: 'collaborator',
      lists: {
        [RETRO_DATE]: [
          action(A2, 'Dividir tarefas grandes', {
            responsibleId: MANAGER,
            responsibleName: 'Marta Gestora',
            canToggle: false,
          }),
        ],
      },
    })
    const section = await openRetro(userEvent.setup())
    expect(
      within(section).getByRole<HTMLInputElement>('checkbox', {
        name: 'Marcar Dividir tarefas grandes como feito',
      }).disabled,
    ).toBe(true)
  })

  it('atualiza na hora e volta com aviso quando o servidor recusa', async () => {
    const { api, user } = setup({ role: 'collaborator' })
    let reject!: (reason: Error) => void
    vi.spyOn(api.meetings.retroActions, 'toggle').mockReturnValue(
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise
      }),
    )
    const section = await openRetro(user)
    const checkbox = within(section).getByRole<HTMLInputElement>('checkbox', {
      name: 'Marcar Escrever checklist de release como feito',
    })
    await user.click(checkbox)
    await waitFor(() => expect(checkbox.checked).toBe(true))
    reject(new Error('Falhou'))
    await waitFor(() => expect(checkbox.checked).toBe(false))
    expect(await screen.findByText('Não foi possível marcar o combinado.')).toBeTruthy()
  })
})

describe('Combinados: gestor adiciona', () => {
  it('bloqueia título vazio e título com 201 caracteres', async () => {
    const { api, user } = setup({ role: 'manager' })
    const add = vi.spyOn(api.meetings.retroActions, 'add').mockResolvedValue(action(A1, ''))
    await openRetro(user)
    const form = screen.getByRole('form', { name: 'Adicionar combinado' })
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }))
    expect(within(form).getByText('Escreva o combinado.')).toBeTruthy()
    await user.type(within(form).getByLabelText('Combinado'), 'a'.repeat(201))
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }))
    expect(within(form).getByText('O combinado pode ter até 200 caracteres.')).toBeTruthy()
    expect(add).not.toHaveBeenCalled()
  })

  it('recusa prazo anterior à retro', async () => {
    const { api, user } = setup({ role: 'manager' })
    const add = vi.spyOn(api.meetings.retroActions, 'add').mockResolvedValue(action(A1, ''))
    await openRetro(user)
    const form = screen.getByRole('form', { name: 'Adicionar combinado' })
    await user.type(within(form).getByLabelText('Combinado'), 'Revisar testes')
    fireEvent.change(within(form).getByLabelText('Prazo (opcional)'), {
      target: { value: '2026-11-05' },
    })
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }))
    expect(within(form).getByText('O prazo não pode ser antes da retro.')).toBeTruthy()
    expect(add).not.toHaveBeenCalled()
  })

  it('o responsável vem só da lista de usuários, sem entidades', async () => {
    const { user } = setup({ role: 'manager' })
    await openRetro(user)
    const form = screen.getByRole('form', { name: 'Adicionar combinado' })
    const options = within(form)
      .getAllByRole<HTMLOptionElement>('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['Sem responsável', 'Marta Gestora', 'Ana Souza'])
  })

  it('Enter adiciona com responsável e prazo, e mantém o foco no campo', async () => {
    const { api, user } = setup({ role: 'manager' })
    const add = vi.spyOn(api.meetings.retroActions, 'add').mockResolvedValue(action(A1, ''))
    await openRetro(user)
    const form = screen.getByRole('form', { name: 'Adicionar combinado' })
    const title = within(form).getByLabelText('Combinado')
    await user.type(title, 'Revisar fluxo de aprovação')
    await user.selectOptions(within(form).getByLabelText('Responsável'), ANA)
    fireEvent.change(within(form).getByLabelText('Prazo (opcional)'), {
      target: { value: '2026-11-10' },
    })
    await user.type(title, '{Enter}')
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        meetingId: RETRO_SERIES,
        occurrenceDate: RETRO_DATE,
        title: 'Revisar fluxo de aprovação',
        responsibleId: ANA,
        dueDate: '2026-11-10',
      }),
    )
    await waitFor(() => expect(document.activeElement).toBe(title))
    expect((title as HTMLInputElement).value).toBe('')
  })

  it('no limite de 30 some o formulário e mostra "Limite de 30 combinados."', async () => {
    const full = Array.from({ length: 30 }, (_, index) =>
      action(`01J8Y4G2XK8Z1S6M3Q9W0AL${String(index).padStart(3, '0')}`, `Combinado ${index + 1}`),
    )
    setup({ role: 'manager', lists: { [RETRO_DATE]: full } })
    const section = await openRetro(userEvent.setup())
    expect(within(section).getByText('Limite de 30 combinados.')).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'Adicionar combinado' })).toBeNull()
  })
})

describe('Combinados: gestor edita e remove', () => {
  it('edita em linha, salva e cancela com Esc', async () => {
    const { api, user } = setup({ role: 'manager' })
    const update = vi.spyOn(api.meetings.retroActions, 'update').mockResolvedValue(action(A1, ''))
    const section = await openRetro(user)
    await user.click(
      within(section).getByRole('button', { name: 'Editar Dividir tarefas grandes' }),
    )
    const edit = screen.getByRole('form', { name: 'Editar combinado' })
    const title = within(edit).getByLabelText('Combinado')
    await user.clear(title)
    await user.type(title, 'Dividir tarefas em PRs menores')
    await user.click(within(edit).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        actionId: A2,
        changes: {
          title: 'Dividir tarefas em PRs menores',
          responsibleId: MANAGER,
          dueDate: null,
        },
      }),
    )
  })

  it('Esc cancela a edição sem salvar', async () => {
    const { api, user } = setup({ role: 'manager' })
    const update = vi.spyOn(api.meetings.retroActions, 'update')
    const section = await openRetro(user)
    await user.click(
      within(section).getByRole('button', { name: 'Editar Dividir tarefas grandes' }),
    )
    const edit = screen.getByRole('form', { name: 'Editar combinado' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('form', { name: 'Editar combinado' })).toBeNull()
    expect(update).not.toHaveBeenCalled()
    expect(edit).toBeTruthy()
  })

  it('remove só depois da confirmação inline', async () => {
    const { api, user } = setup({ role: 'manager' })
    const remove = vi.spyOn(api.meetings.retroActions, 'remove').mockResolvedValue(undefined)
    const section = await openRetro(user)
    await user.click(
      within(section).getByRole('button', { name: 'Remover Revisar fluxo de aprovação' }),
    )
    const confirm = screen.getByRole('group', { name: 'Remover este combinado?' })
    expect(remove).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Manter' }))
    expect(screen.queryByRole('group', { name: 'Remover este combinado?' })).toBeNull()
    await user.click(
      within(section).getByRole('button', { name: 'Remover Revisar fluxo de aprovação' }),
    )
    await user.click(
      within(screen.getByRole('group', { name: 'Remover este combinado?' })).getByRole('button', {
        name: 'Remover',
      }),
    )
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ actionId: A1 }))
  })
})

describe('Combinados: ocorrências da mesma série', () => {
  it('cada repetição tem a própria lista', async () => {
    const lists = {
      [RETRO_DATE]: [action(A1, 'Combinado do dia seis')],
      [NEXT_RETRO_DATE]: [action(A2, 'Combinado do dia treze')],
    }
    const occurrences = [
      retro(RETRO_DATE, { retroActionsCount: 1, retroActionsDone: 0 }),
      retro(NEXT_RETRO_DATE, { retroActionsCount: 1, retroActionsDone: 0 }),
    ]
    setup({ role: 'collaborator', meetings: occurrences, lists })
    const upcoming = await screen.findByRole('region', { name: 'Próximos agendamentos' })
    const cards = within(upcoming).getAllByRole('button', { name: /Retrospectiva da sprint/ })
    const user = userEvent.setup()
    await user.click(cards[0]!)
    expect(await screen.findByText('Combinado do dia seis')).toBeTruthy()
    expect(screen.queryByText('Combinado do dia treze')).toBeNull()
    await user.click(cards[1]!)
    expect(await screen.findByText('Combinado do dia treze')).toBeTruthy()
    expect(screen.queryByText('Combinado do dia seis')).toBeNull()
  })
})

describe('Combinados: contador "2/3" nos cartões e chips', () => {
  it('mostra no cartão de Próximos e no chip do mês', async () => {
    const { user } = setup({ role: 'collaborator' })
    const upcoming = await screen.findByRole('region', { name: 'Próximos agendamentos' })
    const card = within(upcoming).getByRole('button', { name: /Retrospectiva da sprint/ })
    const count = within(card).getByRole('img', { name: '2 de 3 combinados feitos' })
    expect(count.textContent).toBe('2/3')

    await user.click(screen.getByRole('button', { name: 'Mês' }))
    const day = await screen.findByRole('button', { name: /sexta-feira, 6 de novembro/i })
    expect(within(day).getByRole('img', { name: '2 de 3 combinados feitos' }).textContent).toBe(
      '2/3',
    )
  })

  it('mostra no evento da grade semanal', async () => {
    const { user } = setup({ role: 'collaborator' })
    await user.click(await screen.findByRole('button', { name: 'Próximo período' }))
    const event = await screen.findByRole('button', { name: /Retrospectiva da sprint, Retro/ })
    expect(event.getAttribute('aria-label')).toContain('2 de 3 combinados feitos')
    expect(within(event).getByText('2/3')).toBeTruthy()
  })

  it('não mostra contador em retro sem combinados', async () => {
    setup({
      role: 'collaborator',
      meetings: [retro(RETRO_DATE, { retroActionsCount: 0, retroActionsDone: 0 })],
    })
    const upcoming = await screen.findByRole('region', { name: 'Próximos agendamentos' })
    const card = within(upcoming).getByRole('button', { name: /Retrospectiva da sprint/ })
    expect(within(card).queryByRole('img', { name: /combinado/ })).toBeNull()
  })
})
