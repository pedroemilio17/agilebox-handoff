import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ProjectDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { panelCopy } from '../copy'
import { ProjectDialog } from './ProjectDialog'

afterEach(cleanup)

const AURORA = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'
const NOVO = '01J8Y4G2XK8Z1S6M3Q9W0A5BC3'

function makeProject(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: AURORA,
    name: 'Projeto Aurora',
    createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
    createdAt: '2026-10-31T12:00:00.000Z',
    definitionOfDoneCount: 0,
    archivedAt: null,
    ...overrides,
  }
}

function renderDialog(projects: ProjectDto[] = [makeProject()]) {
  const api = createFakeApi()
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([])
  const createWithSetup = vi.spyOn(api.projects, 'createWithSetup').mockImplementation((input) =>
    Promise.resolve({
      ...makeProject(),
      id: NOVO,
      name: input.name,
      modules: ['core'],
      startedFromPreset: input.startedFromPreset ?? null,
    }),
  )
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <ProjectDialog
          open
          projects={projects}
          selectedProjectId={null}
          onSelect={onSelect}
          onClose={onClose}
        />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, createWithSetup, onSelect, onClose, user: userEvent.setup() }
}

const continueButton = () => screen.getByRole('button', { name: /^Continuar/ })
const radio = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name })

/** Abre o assistente pelo diálogo, com o nome digitado. */
async function openFlowWithName(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: panelCopy.newProject }))
  await user.type(screen.getByRole('textbox', { name: panelCopy.newProjectName }), name)
  await user.click(screen.getByRole('button', { name: panelCopy.create }))
}

/** Responde as perguntas de um projeto ágil com custo e horas, até a recomendação. */
async function answerToRecommendation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(continueButton())
  await user.click(radio('Tem fim'))
  await user.click(continueButton())
  await user.click(radio('Não'))
  await user.click(continueButton())
  await user.click(radio('Vai mudar no caminho'))
  await user.click(continueButton())
  await user.click(radio('Não'))
  await user.click(continueButton())
  await user.click(radio('Sim'))
  await user.click(continueButton())
}

describe('Criar projeto pelo assistente no diálogo de projetos', () => {
  it('"Criar" abre o assistente com o nome digitado e esconde o diálogo', async () => {
    const { user } = renderDialog()
    await openFlowWithName(user, 'Portal')

    expect(screen.getByRole('heading', { name: 'Qual é o nome do projeto?' })).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Nome do projeto' }).value).toBe(
      'Portal',
    )
    expect(screen.queryByRole('dialog', { name: panelCopy.projectDialogTitle })).toBeNull()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('pular cria o projeto Simples só com nome e seleciona o criado', async () => {
    const { user, createWithSetup, onSelect, onClose } = renderDialog()
    await openFlowWithName(user, 'Portal')

    await user.click(screen.getByRole('button', { name: 'Pular e criar no modo Simples' }))

    expect(createWithSetup).toHaveBeenCalledWith({ name: 'Portal', startedFromPreset: 'simples' })
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(NOVO))
    expect(onClose).toHaveBeenCalled()
  })

  it('wizard completo chama a criação com respostas, módulos, preset e nível de guia', async () => {
    const { user, createWithSetup } = renderDialog()
    await openFlowWithName(user, 'App de Chamados')

    await answerToRecommendation(user)
    expect(screen.getByRole('heading', { name: 'Ágil (Scrum)' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect(createWithSetup).toHaveBeenCalledWith({
      name: 'App de Chamados',
      startedFromPreset: 'agil',
      guideLevel: 'never',
      modules: [
        'agenda',
        'backlog',
        'sprints',
        'checkins',
        'estimates.hours',
        'reviewRetro',
        'cost',
      ],
      answers: {
        workType: 'finite',
        fixedDate: 'no',
        scope: 'will_change',
        outsiderFollows: 'no',
        controlsHoursAndCost: 'yes',
        experience: 'never',
      },
    })
  })

  it('erro da API aparece na recomendação e mantém o assistente aberto', async () => {
    const { user, createWithSetup, onSelect, onClose } = renderDialog()
    createWithSetup.mockRejectedValueOnce(
      new ApiError('CONFLICT', 'Não foi possível guardar a configuração do projeto.'),
    )
    await openFlowWithName(user, 'App de Chamados')
    await answerToRecommendation(user)

    await user.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Não foi possível guardar a configuração do projeto.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ágil (Scrum)' })).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('erro sem mensagem do servidor mostra o texto padrão da tela', async () => {
    const { user, createWithSetup } = renderDialog()
    createWithSetup.mockRejectedValueOnce(new Error('rede caiu'))
    await openFlowWithName(user, 'App de Chamados')
    await answerToRecommendation(user)

    await user.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect(await screen.findByText(panelCopy.createProjectError)).toBeTruthy()
  })

  it('cancelar fecha o assistente e devolve o foco ao botão Criar', async () => {
    const { user, createWithSetup, onSelect } = renderDialog()
    await openFlowWithName(user, 'Portal')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('heading', { name: 'Qual é o nome do projeto?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: panelCopy.projectDialogTitle })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: panelCopy.create }))
    expect(createWithSetup).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('nome repetido já listado seleciona o existente, sem o assistente', async () => {
    const { user, createWithSetup, onSelect } = renderDialog()
    await user.click(screen.getByRole('button', { name: panelCopy.newProject }))
    await user.type(
      screen.getByRole('textbox', { name: panelCopy.newProjectName }),
      '  projeto aurora ',
    )
    await user.click(screen.getByRole('button', { name: panelCopy.create }))

    expect(onSelect).toHaveBeenCalledWith(AURORA)
    expect(createWithSetup).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Qual é o nome do projeto?' })).toBeNull()
  })

  it('nome repetido que a API devolve seleciona o projeto existente', async () => {
    const { user, createWithSetup, onSelect } = renderDialog([])
    createWithSetup.mockResolvedValueOnce({
      ...makeProject(),
      modules: ['core'],
      startedFromPreset: null,
    })
    await openFlowWithName(user, 'Projeto Aurora')

    await user.click(screen.getByRole('button', { name: 'Pular e criar no modo Simples' }))

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(AURORA))
  })
})
