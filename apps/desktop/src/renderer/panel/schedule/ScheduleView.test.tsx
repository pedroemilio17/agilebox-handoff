import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ScheduleViewDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { FLOW_TASK, toTaskDto } from '../../shared/testing/flow-backend'
import { deliverableRow, wbsView, wbsId } from '../wbs/wbs-fixtures'
import {
  DELIVERABLE_A,
  dependency,
  scheduleTask,
  scheduleView,
  SCHEDULE_PROJECT,
  taskId,
} from './schedule-fixtures'
import { ScheduleView } from './ScheduleView'

const TODAY = '2026-11-16'
const CADASTRO = taskId('1')
const PLANO = taskId('2')
const INTEGRACAO = taskId('3')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function sampleView(overrides: Partial<ScheduleViewDto> = {}): ScheduleViewDto {
  return scheduleView({
    today: TODAY,
    tasks: [
      scheduleTask({
        taskId: CADASTRO,
        key: 'ERP-1',
        title: 'Cadastro de produtos',
        startsOn: '2026-11-02',
        deadline: '2026-11-20',
      }),
      scheduleTask({
        taskId: PLANO,
        key: 'ERP-2',
        title: 'Plano de contas',
        startsOn: '2026-11-03',
        deadline: '2026-11-10',
        done: true,
        progress: 100,
        status: 'done',
      }),
      scheduleTask({
        taskId: INTEGRACAO,
        key: 'ERP-3',
        title: 'Integração bancária',
        startsOn: null,
        deadline: null,
        canEdit: false,
      }),
    ],
    milestones: [{ id: wbsId('M1'), title: 'Virada', dueOn: '2026-12-18' }],
    ...overrides,
  })
}

function setup(view: ScheduleViewDto = sampleView()) {
  const api = createFakeApi()
  vi.spyOn(api.schedule, 'get').mockResolvedValue(view)
  vi.spyOn(api.tasks, 'setStart').mockResolvedValue(toTaskDto(FLOW_TASK))
  vi.spyOn(api.tasks, 'update').mockResolvedValue(toTaskDto(FLOW_TASK))
  vi.spyOn(api.schedule, 'addDependency').mockResolvedValue(view)
  vi.spyOn(api.schedule, 'removeDependency').mockResolvedValue(view)
  renderPanel(<ScheduleView projectId={SCHEDULE_PROJECT} projectName="Implantação ERP" />, { api })
  return api
}

describe('Gantt', () => {
  it('desenha barras com nome e datas, marco e a linha de hoje', async () => {
    setup()
    expect(
      await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' }),
    ).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Marco: Virada, 18/12' })).toBeTruthy()
    const bar = screen.getByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    expect(bar.getAttribute('data-state')).toBe('current')
    expect(
      screen
        .getByRole('img', { name: 'Plano de contas: início 03/11, prazo 10/11' })
        .getAttribute('data-state'),
    ).toBe('done')
    // Hoje cai dentro do eixo: a linha existe no overlay decorativo.
    expect(document.querySelector('[class*="todayLine"]')).not.toBeNull()
  })

  it('tarefa sem as duas datas não tem barra, mas aparece com "sem datas"', async () => {
    setup()
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    const row = screen.getByRole('row', { name: /Integração bancária/ })
    // Início, prazo e situação dizem "sem datas"; o Gantt também mostra o aviso no lugar da barra.
    expect(within(row).getAllByText('sem datas').length).toBe(3)
    expect(screen.getByRole('region', { name: /Linha do tempo/ }).textContent).toContain(
      'sem datas',
    )
    expect(screen.queryByRole('img', { name: /Integração bancária/ })).toBeNull()
  })

  it('troca entre Semanas e Meses pelo grupo de botões', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    const weeks = screen.getByRole('button', { name: 'Semanas' })
    const months = screen.getByRole('button', { name: 'Meses' })
    expect(weeks.getAttribute('aria-pressed')).toBe('true')
    expect(months.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByText('nov/26')).toBeNull()

    await user.click(months)
    expect(months.getAttribute('aria-pressed')).toBe('true')
    expect(weeks.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('nov/26')).toBeTruthy()
  })

  it('setas só aparecem entre tarefas com barra, e conflito fica destacado com o resumo', async () => {
    const view = sampleView({
      dependencies: [dependency(CADASTRO, PLANO, true), dependency(CADASTRO, INTEGRACAO)],
    })
    setup(view)
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    const paths = Array.from(document.querySelectorAll('path[class*="depLine"]'))
    expect(paths).toHaveLength(1)
    expect(paths[0]?.getAttribute('data-conflict')).toBe('true')

    const alert = screen.getByRole('region', { name: 'Conflitos de dependência' })
    expect(
      within(alert).getByText(
        /1 dependência com conflito: Cadastro de produtos termina depois do início de Plano de contas/,
      ),
    ).toBeTruthy()
  })
})

describe('faixa de alerta', () => {
  it('não aparece sem conflito', async () => {
    setup(sampleView({ dependencies: [dependency(CADASTRO, PLANO)] }))
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    expect(screen.queryByRole('region', { name: 'Conflitos de dependência' })).toBeNull()
  })
})

describe('lista de datas', () => {
  it('muda início e prazo pelo servidor com os valores certos', async () => {
    const api = setup()
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })

    fireEvent.change(screen.getByLabelText('Início de Cadastro de produtos'), {
      target: { value: '2026-11-05' },
    })
    await waitFor(() =>
      expect(api.tasks.setStart).toHaveBeenCalledWith({ taskId: CADASTRO, startsOn: '2026-11-05' }),
    )

    fireEvent.change(screen.getByLabelText('Prazo de Cadastro de produtos'), {
      target: { value: '2026-11-25' },
    })
    await waitFor(() =>
      expect(api.tasks.update).toHaveBeenCalledWith({
        taskId: CADASTRO,
        changes: { deadline: '2026-11-25' },
      }),
    )
  })

  it('limpar o início ao sair do campo envia nulo', async () => {
    const api = setup()
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    const start = screen.getByLabelText('Início de Cadastro de produtos')
    fireEvent.change(start, { target: { value: '' } })
    fireEvent.blur(start)
    await waitFor(() =>
      expect(api.tasks.setStart).toHaveBeenCalledWith({ taskId: CADASTRO, startsOn: null }),
    )
  })

  it('início depois do prazo é recusado na tela, sem chamar o servidor', async () => {
    const api = setup()
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    fireEvent.change(screen.getByLabelText('Início de Cadastro de produtos'), {
      target: { value: '2026-12-01' },
    })
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'O início não pode ser depois do prazo.',
    )
    expect(api.tasks.setStart).not.toHaveBeenCalled()
  })

  it('erro do servidor aparece em role="alert"', async () => {
    const api = setup()
    vi.mocked(api.tasks.setStart).mockRejectedValue(
      new ApiError('CONFLICT', 'Tarefa travada pelo gestor.'),
    )
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    fireEvent.change(screen.getByLabelText('Início de Cadastro de produtos'), {
      target: { value: '2026-11-04' },
    })
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Tarefa travada pelo gestor.',
    )
  })

  it('sem canEdit na tarefa, os campos de data não aparecem', async () => {
    setup()
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    expect(screen.queryByLabelText('Início de Integração bancária')).toBeNull()
    expect(screen.queryByLabelText('Prazo de Integração bancária')).toBeNull()
    expect(screen.getByLabelText('Início de Cadastro de produtos')).toBeTruthy()
  })
})

describe('dependências', () => {
  it('adiciona uma dependência pelos selects', async () => {
    const user = userEvent.setup()
    const api = setup(sampleView({ dependencies: [] }))
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    await user.selectOptions(screen.getByLabelText('Sucessora'), PLANO)
    await user.selectOptions(screen.getByLabelText('Predecessora'), CADASTRO)
    await user.click(screen.getByRole('button', { name: 'Adicionar dependência' }))
    await waitFor(() =>
      expect(api.schedule.addDependency).toHaveBeenCalledWith({
        predecessorId: CADASTRO,
        successorId: PLANO,
      }),
    )
  })

  it('remove uma dependência existente', async () => {
    const user = userEvent.setup()
    const api = setup(sampleView({ dependencies: [dependency(CADASTRO, PLANO)] }))
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    await user.click(
      screen.getByRole('button', {
        name: 'Remover a dependência de Plano de contas em Cadastro de produtos',
      }),
    )
    await waitFor(() =>
      expect(api.schedule.removeDependency).toHaveBeenCalledWith({
        predecessorId: CADASTRO,
        successorId: PLANO,
      }),
    )
  })

  it('a predecessora nunca é a própria sucessora nas opções', async () => {
    const user = userEvent.setup()
    setup(sampleView())
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    await user.selectOptions(screen.getByLabelText('Sucessora'), PLANO)
    const predecessor = screen.getByLabelText('Predecessora')
    expect(within(predecessor).queryByRole('option', { name: 'ERP-2 Plano de contas' })).toBeNull()
  })

  it('sem canEdit na tarefa, não há remoção para ela', async () => {
    setup(sampleView({ dependencies: [dependency(CADASTRO, INTEGRACAO)] }))
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    expect(
      screen.queryByRole('button', { name: /Remover a dependência de Integração bancária/ }),
    ).toBeNull()
  })
})

describe('estados', () => {
  it('sem projeto pede para escolher um', () => {
    const api = createFakeApi()
    renderPanel(<ScheduleView projectId={null} projectName={null} />, { api })
    expect(screen.getByText('Escolha um projeto para ver o cronograma.')).toBeTruthy()
  })

  it('sem nenhuma tarefa com as duas datas, mostra o estado vazio que ensina', async () => {
    setup(
      sampleView({
        range: null,
        tasks: [scheduleTask({ taskId: CADASTRO, startsOn: null, deadline: null })],
      }),
    )
    // Texto do manifesto do módulo (o guia padrão dos testes é "Nunca", com a explicação curta).
    expect(await screen.findByText('Nenhuma tarefa com datas.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Linha do tempo/ })).toBeNull()
  })

  it('erro ao carregar oferece tentar de novo', async () => {
    const api = createFakeApi()
    vi.spyOn(api.schedule, 'get').mockRejectedValue(new ApiError('CONFLICT', 'falhou'))
    renderPanel(<ScheduleView projectId={SCHEDULE_PROJECT} projectName="Implantação ERP" />, {
      api,
    })
    expect(
      await screen.findByText('Não foi possível carregar o cronograma deste projeto.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('com a EAP ligada, agrupa pelas entregas e mostra o código', async () => {
    const api = createFakeApi()
    vi.spyOn(api.schedule, 'get').mockResolvedValue(
      sampleView({
        tasks: [
          scheduleTask({
            taskId: CADASTRO,
            deliverableId: DELIVERABLE_A,
            startsOn: '2026-11-02',
            deadline: '2026-11-20',
          }),
        ],
        milestones: [],
      }),
    )
    vi.spyOn(api.wbs, 'get').mockResolvedValue(
      wbsView([deliverableRow(DELIVERABLE_A, { code: '1.1', title: 'Configuração' })]),
    )
    renderPanel(<ScheduleView projectId={SCHEDULE_PROJECT} projectName="Implantação ERP" />, {
      api,
    })
    expect(await screen.findByText('1.1')).toBeTruthy()
    expect(screen.getAllByText('Configuração').length).toBeGreaterThan(0)
  })
})

describe('linha de base no cronograma', () => {
  it('mostra o interruptor com a data da foto e marca o atraso frente à base', async () => {
    const api = createFakeApi()
    vi.spyOn(api.schedule, 'get').mockResolvedValue(sampleView())
    vi.spyOn(api.baseline, 'get').mockResolvedValue({
      projectId: SCHEDULE_PROJECT,
      canTake: true,
      costEnabled: false,
      costVisible: false,
      baseline: {
        id: wbsId('B1'),
        name: 'Linha de base de 03/11/2026',
        takenAt: '2026-11-03T12:00:00.000Z',
        takenByName: 'Pedro',
      },
      summary: null,
      tasks: [
        {
          taskId: CADASTRO,
          title: 'Cadastro de produtos',
          status: 'late',
          delayDays: 7,
          startDelayDays: 0,
          endDelayDays: 7,
          plannedStartsOn: '2026-11-02',
          plannedEndsOn: '2026-11-13',
          currentStartsOn: '2026-11-02',
          currentEndsOn: '2026-11-20',
          hoursDelta: null,
          costDelta: null,
        },
      ],
    })
    renderPanel(<ScheduleView projectId={SCHEDULE_PROJECT} projectName="Implantação ERP" />, {
      api,
    })
    const toggle = await screen.findByRole('switch', { name: 'Linha de base de 03/11' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('+7 dias')).toBeTruthy()
    expect(
      screen
        .getByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
        .getAttribute('data-state'),
    ).toBe('late')

    await userEvent.setup().click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByText('+7 dias')).toBeNull()
  })

  it('sem foto, não mostra o interruptor', async () => {
    const api = createFakeApi()
    vi.spyOn(api.schedule, 'get').mockResolvedValue(sampleView())
    vi.spyOn(api.baseline, 'get').mockResolvedValue({
      projectId: SCHEDULE_PROJECT,
      canTake: true,
      costEnabled: false,
      costVisible: false,
      baseline: null,
      summary: null,
      tasks: [],
    })
    renderPanel(<ScheduleView projectId={SCHEDULE_PROJECT} projectName="Implantação ERP" />, {
      api,
    })
    await screen.findByRole('img', { name: 'Cadastro de produtos: início 02/11, prazo 20/11' })
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
