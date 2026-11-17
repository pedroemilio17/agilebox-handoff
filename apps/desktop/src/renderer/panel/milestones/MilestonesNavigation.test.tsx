import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuideViewDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { GuideCard } from '../guide/GuideCard'
import { GUIDE_PROJECT_ID, makeGuide } from '../guide/guide-fixtures'

afterEach(cleanup)

/** Trilha com um único passo, o de marcos, como atual. */
function milestonesGuide(): GuideViewDto {
  const base = makeGuide({ doneCount: 0, firstStepsCard: 'open' })
  return {
    ...base,
    trail: [
      {
        key: 'milestones.create',
        title: 'Marque os marcos',
        why: 'Quem está de fora acompanha o projeto pelas datas.',
        moduleId: 'milestones',
        moduleName: 'Marcos',
        next: null,
        doneWhen: 'milestone.created',
        done: false,
      },
    ],
    done: 0,
    total: 1,
    currentKey: 'milestones.create',
  }
}

describe('guia leva à tela Marcos', () => {
  it('o passo "Marque os marcos" tem o botão "Abrir os marcos" que navega para a tela', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    vi.spyOn(api.guide, 'get').mockResolvedValue(milestonesGuide())
    const onNavigate = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <GuideCard projectId={GUIDE_PROJECT_ID} onNavigate={onNavigate} />
        </QueryClientProvider>
      </ApiProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Abrir os marcos' }))
    expect(onNavigate).toHaveBeenCalledWith('milestones')
  })
})
