import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { createFakeApi } from '../../shared/testing/fake-api'
import { useRenameProject } from './use-rename-project'

afterEach(() => vi.restoreAllMocks())

const AURORA = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'
const BORI = '01J8Y4G2XK8Z1S6M3Q9W0A5BC2'

function project(id: string, name: string): ProjectDto {
  return {
    id,
    name,
    createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
    createdAt: '2026-10-31T12:00:00.000Z',
    definitionOfDoneCount: 0,
    archivedAt: null,
  }
}

describe('useRenameProject', () => {
  it('troca o nome na lista de projetos assim que o servidor responde', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(queryKeys.projects.list, [
      project(AURORA, 'Projeto Aurora'),
      project(BORI, 'Projeto Bori'),
    ])
    const api = createFakeApi()
    vi.spyOn(api.projects, 'rename').mockResolvedValue(project(AURORA, 'Aurora Nova'))
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider api={api}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ApiProvider>
    )
    const { result } = renderHook(() => useRenameProject(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ projectId: AURORA, name: 'Aurora Nova' })
    })

    await waitFor(() =>
      expect(client.getQueryData<ProjectDto[]>(queryKeys.projects.list)).toEqual([
        project(AURORA, 'Aurora Nova'),
        project(BORI, 'Projeto Bori'),
      ]),
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all })
  })
})
