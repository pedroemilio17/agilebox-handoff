import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { panelCopy } from '../copy'
import { ProjectDialog } from './ProjectDialog'

afterEach(cleanup)

const AURORA = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'

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
  project: ProjectDto,
  props: Partial<Parameters<typeof ProjectDialog>[0]> = {},
) {
  const api = createFakeApi()
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([])
  vi.spyOn(api.projects, 'archive').mockResolvedValue({
    ...project,
    archivedAt: '2026-11-02T09:00:00.000Z',
  })
  vi.spyOn(api.projects, 'unarchive').mockResolvedValue({ ...project, archivedAt: null })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <ProjectDialog
          open
          projects={[project]}
          selectedProjectId={project.id}
          onSelect={() => undefined}
          onClose={() => undefined}
          canArchiveProject={() => true}
          {...props}
        />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, user: userEvent.setup() }
}

describe('Arquivar projeto no diálogo de projetos', () => {
  it('não mostra arquivar para quem não pode', () => {
    renderDialog(makeProject(), { canArchiveProject: () => false })
    expect(screen.queryByRole('button', { name: panelCopy.archiveProjectAction })).toBeNull()
  })

  it('arquiva depois de confirmar', async () => {
    const { api, user } = renderDialog(makeProject())
    await user.click(screen.getByRole('button', { name: panelCopy.archiveProjectAction }))
    expect(screen.getByText(/Ele não aceita tarefas novas/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(api.projects.archive).toHaveBeenCalledWith({ projectId: AURORA }))
  })

  it('projeto arquivado mostra Desarquivar e a marcação na lista', async () => {
    const { api, user } = renderDialog(makeProject({ archivedAt: '2026-11-02T09:00:00.000Z' }))
    expect(screen.getByText(panelCopy.archivedProject)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: panelCopy.unarchiveProjectAction }))
    await waitFor(() => expect(api.projects.unarchive).toHaveBeenCalledWith({ projectId: AURORA }))
  })

  it('"Mostrar arquivados" começa desligado e avisa o pai', async () => {
    const onShowArchivedChange = vi.fn()
    const { user } = renderDialog(makeProject(), { onShowArchivedChange, showArchived: false })
    const toggle = screen.getByRole('button', { name: panelCopy.showArchived })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    await user.click(toggle)
    expect(onShowArchivedChange).toHaveBeenCalledWith(true)
  })
})
