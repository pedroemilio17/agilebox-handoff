import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import type { PanelView } from '../layout/PanelShell'
import { GuideCard } from './GuideCard'
import { guideCopy } from './guide-copy'
import { GUIDE_PROJECT_ID, makeGuide } from './guide-fixtures'

afterEach(cleanup)

/** Cartão numa tela (ou no quadro, sem `view`). Com `doneCount: 1` o passo atual é o backlog. */
function renderBridge(
  options: {
    doneCount?: number
    firstStepsCard?: 'open' | 'collapsed'
    view?: PanelView
    withTray?: boolean
  } = {},
) {
  const api = createFakeApi()
  vi.spyOn(api.guide, 'get').mockResolvedValue(
    makeGuide({
      doneCount: options.doneCount ?? 1,
      firstStepsCard: options.firstStepsCard ?? 'open',
    }),
  )
  vi.spyOn(api.guide, 'dismissCard').mockResolvedValue(undefined)
  const onNavigate = vi.fn()
  const onOpenTray = vi.fn()
  renderPanel(
    <GuideCard
      projectId={GUIDE_PROJECT_ID}
      onNavigate={onNavigate}
      onOpenTray={options.withTray ? onOpenTray : undefined}
      view={options.view}
    />,
    { api },
  )
  return { onNavigate, onOpenTray }
}

describe('GuideCard · ponte para a tela do passo', () => {
  it('no quadro, o botão do passo atual leva à tela dele', async () => {
    const user = userEvent.setup()
    const { onNavigate } = renderBridge({ view: 'projects' })
    await user.click(await screen.findByRole('button', { name: 'Abrir o backlog' }))
    expect(onNavigate).toHaveBeenCalledWith('backlog')
  })

  it('em outra tela, o passo atual vem recolhido com o título no cabeçalho', async () => {
    const { onNavigate } = renderBridge({ view: 'sprints' })
    expect(await screen.findByText('Ordene pela importância')).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Expandir' })).not.toBeNull()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('na tela do próprio passo, abre e troca o botão pela orientação', async () => {
    renderBridge({ view: 'backlog' })
    expect(await screen.findByRole('list', { name: 'Passos do projeto' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir o backlog' })).toBeNull()
    expect(screen.getByText(guideCopy.onThisScreen)).not.toBeNull()
  })

  it('o passo diário leva à bandeja quando o painel pode abri-la', async () => {
    const user = userEvent.setup()
    const { onOpenTray } = renderBridge({ doneCount: 4, withTray: true })
    await user.click(await screen.findByRole('button', { name: 'Abrir a bandeja' }))
    expect(onOpenTray).toHaveBeenCalledTimes(1)
  })

  it('o passo de sprint, no quadro, mostra o botão que leva às sprints', async () => {
    const user = userEvent.setup()
    const { onNavigate } = renderBridge({ doneCount: 2, view: 'projects' })
    const list = await screen.findByRole('list', { name: 'Passos do projeto' })
    expect(within(list).getByText('Crie a primeira sprint')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Abrir sprints' }))
    expect(onNavigate).toHaveBeenCalledWith('sprints')
  })
})
