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
const BOREAL = '01J8Y4G2XK8Z1S6M3Q9W0A5BC2'

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

function renderDialog(
  projects: ProjectDto[] = [makeProject()],
  props: Partial<Parameters<typeof ProjectDialog>[0]> = {},
) {
  const api = createFakeApi()
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([])
  const renamed = vi
    .spyOn(api.projects, 'rename')
    .mockImplementation((input) =>
      Promise.resolve({ ...makeProject(), id: input.projectId, name: input.name }),
    )
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <ProjectDialog
          open
          projects={projects}
          selectedProjectId={AURORA}
          onSelect={() => undefined}
          onClose={() => undefined}
          canRenameProject={() => true}
          {...props}
        />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, renamed, user: userEvent.setup() }
}

async function openRename(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: panelCopy.renameProjectAction }))
  return screen.getByRole('textbox', { name: panelCopy.renameProjectName })
}

describe('Renomear projeto no diálogo de projetos', () => {
  it('não mostra Renomear para quem não pode', () => {
    renderDialog([makeProject()], { canRenameProject: () => false })
    expect(screen.queryByRole('button', { name: panelCopy.renameProjectAction })).toBeNull()
  })

  it('não mostra Renomear para projeto arquivado, mesmo para quem pode', () => {
    renderDialog([makeProject({ archivedAt: '2026-11-02T09:00:00.000Z' })])
    expect(screen.queryByRole('button', { name: panelCopy.renameProjectAction })).toBeNull()
  })

  it('abre o campo com o nome atual e Enter salva o nome aparado', async () => {
    const { renamed, user } = renderDialog()
    const input = await openRename(user)
    expect((input as HTMLInputElement).value).toBe('Projeto Aurora')
    await user.clear(input)
    await user.type(input, '  Projeto Renovado  {Enter}')
    await waitFor(() =>
      expect(renamed).toHaveBeenCalledWith({ projectId: AURORA, name: 'Projeto Renovado' }),
    )
  })

  it('Esc cancela sem chamar o servidor', async () => {
    const { renamed, user } = renderDialog()
    const input = await openRename(user)
    await user.clear(input)
    await user.type(input, 'Outro{Escape}')
    expect(screen.queryByRole('textbox', { name: panelCopy.renameProjectName })).toBeNull()
    expect(renamed).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: panelCopy.renameProjectAction })).toBeTruthy()
  })

  it('nome vazio mostra erro em português e não chama o servidor', async () => {
    const { renamed, user } = renderDialog()
    const input = await openRename(user)
    await user.clear(input)
    await user.type(input, '   {Enter}')
    expect(screen.getByText(panelCopy.renameProjectEmpty)).toBeTruthy()
    expect(renamed).not.toHaveBeenCalled()
  })

  it('nome igual ao de outro projeto (sem diferença de caixa ou acento) não é enviado', async () => {
    const { renamed, user } = renderDialog([
      makeProject(),
      makeProject({ id: BOREAL, name: 'Projeto Boréal' }),
    ])
    const input = await openRename(user)
    await user.clear(input)
    await user.type(input, 'projeto  boreal{Enter}')
    expect(screen.getByText(panelCopy.renameProjectDuplicate)).toBeTruthy()
    expect(renamed).not.toHaveBeenCalled()
  })

  it('mostra a mensagem de conflito que o servidor devolve', async () => {
    const { api, user } = renderDialog()
    vi.spyOn(api.projects, 'rename').mockRejectedValue(
      new ApiError('CONFLICT', 'Já existe um projeto com este nome'),
    )
    const input = await openRename(user)
    await user.clear(input)
    await user.type(input, 'Outro{Enter}')
    expect(await screen.findByText('Já existe um projeto com este nome')).toBeTruthy()
  })

  it('erro genérico do servidor mostra a mensagem padrão de renomear', async () => {
    const { api, user } = renderDialog()
    vi.spyOn(api.projects, 'rename').mockRejectedValue(new ApiError('VALIDATION', 'x'))
    const input = await openRename(user)
    await user.clear(input)
    await user.type(input, 'Outro{Enter}')
    expect(await screen.findByText(panelCopy.renameProjectError)).toBeTruthy()
  })
})
