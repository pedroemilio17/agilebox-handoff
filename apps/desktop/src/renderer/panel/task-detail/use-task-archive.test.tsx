import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { TaskDto } from '@agilebox/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { createFakeApi } from '../../shared/testing/fake-api'
import { UndoProvider } from '../layout/UndoProvider'
import { makeDetail, TASK_ID } from './fixtures'
import { useTaskArchive } from './use-task-archive'

const OTHER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5OTH'

/** Lista do quadro com duas tarefas; a cache guarda o que o servidor devolveu. */
function board(): { readonly id: string }[] {
  return [makeDetail(), makeDetail({ id: OTHER_ID, title: 'Outra tarefa' })]
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup() {
  const api = createFakeApi()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(queryKeys.tasks.board(), board())
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <UndoProvider>{children}</UndoProvider>
      </QueryClientProvider>
    </ApiProvider>
  )
  const hook = renderHook(() => useTaskArchive(TASK_ID, 'Revisar integração'), { wrapper })
  const listedIds = () =>
    (queryClient.getQueryData<{ readonly id: string }[]>(queryKeys.tasks.board()) ?? []).map(
      (task) => task.id,
    )
  return { api, hook, listedIds }
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useTaskArchive', () => {
  it('tira a tarefa das listas na hora, antes da resposta do servidor', async () => {
    const { api, hook, listedIds } = setup()
    const pending = deferred<TaskDto>()
    vi.spyOn(api.tasks, 'archive').mockReturnValue(pending.promise)

    act(() => hook.result.current.mutate())

    await waitFor(() => expect(listedIds()).toEqual([OTHER_ID]))
    pending.resolve(makeDetail())
  })

  it('se o servidor recusar, a lista volta ao que era', async () => {
    const { api, hook, listedIds } = setup()
    vi.spyOn(api.tasks, 'archive').mockRejectedValue(new Error('sem permissão'))

    act(() => hook.result.current.mutate())

    await waitFor(() => expect(hook.result.current.isError).toBe(true))
    expect(listedIds()).toEqual([TASK_ID, OTHER_ID])
  })

  it('depois de arquivar, oferece desfazer que devolve a tarefa pela API', async () => {
    const { api, hook } = setup()
    vi.spyOn(api.tasks, 'archive').mockResolvedValue(makeDetail())
    const unarchive = vi.spyOn(api.tasks, 'unarchive').mockResolvedValue(makeDetail())

    act(() => hook.result.current.mutate())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Tarefa “Revisar integração” arquivada',
    )
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(unarchive).toHaveBeenCalledWith({ taskId: TASK_ID }))
  })
})
