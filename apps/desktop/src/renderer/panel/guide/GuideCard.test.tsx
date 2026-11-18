import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { GuideCard } from './GuideCard'
import { GUIDE_PROJECT_ID, makeGuide } from './guide-fixtures'

afterEach(cleanup)

function renderCard(
  options: { doneCount?: number; firstStepsCard?: 'open' | 'collapsed' | 'hidden' } = {},
  projectId: string | null = GUIDE_PROJECT_ID,
) {
  const api = createFakeApi()
  vi.spyOn(api.guide, 'get').mockResolvedValue(makeGuide(options))
  const dismiss = vi.spyOn(api.guide, 'dismissCard').mockResolvedValue(undefined)
  const onNavigate = vi.fn()
  renderPanel(<GuideCard projectId={projectId} onNavigate={onNavigate} />, { api })
  return { api, dismiss, onNavigate }
}

describe('GuideCard', () => {
  it('abre com a intensidade open e mostra a lista de passos', async () => {
    renderCard({ firstStepsCard: 'open' })
    expect(await screen.findByRole('heading', { name: 'Primeiros passos' })).not.toBeNull()
    expect(screen.getByRole('list', { name: 'Passos do projeto' })).not.toBeNull()
    const toggle = screen.getByRole('button', { name: 'Recolher' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('começa recolhido com a intensidade collapsed', async () => {
    renderCard({ firstStepsCard: 'collapsed' })
    expect(await screen.findByRole('heading', { name: 'Primeiros passos' })).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Expandir' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('não renderiza com a intensidade hidden', async () => {
    const { api } = renderCard({ firstStepsCard: 'hidden' })
    await waitFor(() => expect(api.guide.get).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull()
  })

  it('mostra "1 de 7" e o passo atual marcado com aria-current', async () => {
    renderCard({ doneCount: 1 })
    expect(await screen.findByText('1 de 7')).not.toBeNull()
    const bar = screen.getByRole('progressbar', { name: 'Progresso dos primeiros passos' })
    expect(bar.getAttribute('aria-valuenow')).toBe('1')
    expect(bar.getAttribute('aria-valuemax')).toBe('7')
    const list = screen.getByRole('list', { name: 'Passos do projeto' })
    const current = within(list).getByText('Ordene pela importância').closest('li')
    expect(current?.getAttribute('aria-current')).toBe('step')
    const done = within(list).getByText('Liste o que precisa ser feito').closest('li')
    expect(done?.getAttribute('aria-current')).toBeNull()
  })

  it('o passo atual tem cabeçalho "Passo N" e três colunas: por que, o que fazer agora e o que vem depois', async () => {
    renderCard({ doneCount: 1 })
    const heading = await screen.findByRole('heading', {
      level: 3,
      name: 'Ordene pela importância',
    })
    expect(heading.previousElementSibling?.textContent).toBe('Passo 2')
    expect(screen.getByRole('heading', { level: 4, name: 'Por que existe' })).not.toBeNull()
    expect(screen.getByRole('heading', { level: 4, name: 'O que fazer agora' })).not.toBeNull()
    expect(screen.getByRole('heading', { level: 4, name: 'O que vem depois' })).not.toBeNull()
    expect(screen.getByText('Estime os primeiros itens')).not.toBeNull()
  })

  it('o botão do passo atual leva à tela certa', async () => {
    const user = userEvent.setup()
    const { onNavigate } = renderCard({ doneCount: 1 })
    await user.click(await screen.findByRole('button', { name: 'Abrir o backlog' }))
    expect(onNavigate).toHaveBeenCalledWith('backlog')
  })

  it('o passo de sprint leva às sprints e o de planning à agenda', async () => {
    const user = userEvent.setup()
    const sprints = renderCard({ doneCount: 2 })
    await user.click(await screen.findByRole('button', { name: 'Abrir sprints' }))
    expect(sprints.onNavigate).toHaveBeenCalledWith('sprints')
  })

  it('o passo de planning leva à agenda', async () => {
    const user = userEvent.setup()
    const { onNavigate } = renderCard({ doneCount: 6 })
    await user.click(await screen.findByRole('button', { name: 'Abrir a agenda' }))
    expect(onNavigate).toHaveBeenCalledWith('agenda')
  })

  it('o passo diário não tem botão, só a orientação', async () => {
    renderCard({ doneCount: 4 })
    expect(await screen.findByText('Pela bandeja, no fim do dia')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Abrir/ })).toBeNull()
  })

  it('Recolher e Expandir alternam aria-expanded', async () => {
    const user = userEvent.setup()
    renderCard({ firstStepsCard: 'open' })
    await user.click(await screen.findByRole('button', { name: 'Recolher' }))
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Expandir' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Recolher' }).getAttribute('aria-expanded')).toBe(
      'true',
    )
    expect(screen.getByRole('list', { name: 'Passos do projeto' })).not.toBeNull()
  })

  it('Dispensar chama guide.dismissCard e esconde o cartão', async () => {
    const user = userEvent.setup()
    const { dismiss } = renderCard({ doneCount: 1 })
    await user.click(await screen.findByRole('button', { name: 'Dispensar' }))
    expect(dismiss).toHaveBeenCalledWith({ projectId: GUIDE_PROJECT_ID })
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull(),
    )
  })

  it('com a trilha concluída mostra o estado e só o botão Dispensar', async () => {
    renderCard({ doneCount: 7 })
    expect(await screen.findByRole('heading', { name: 'Trilha concluída' })).not.toBeNull()
    expect(screen.getByText('7 de 7')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Dispensar' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Recolher' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Expandir' })).toBeNull()
  })

  it('sem projeto selecionado não aparece e não consulta o guia', async () => {
    const { api } = renderCard({}, null)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(api.guide.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull()
  })

  it('erro de carga não mostra nada', async () => {
    const api = createFakeApi()
    vi.spyOn(api.guide, 'get').mockRejectedValue(new Error('falhou'))
    renderPanel(<GuideCard projectId={GUIDE_PROJECT_ID} onNavigate={vi.fn()} />, { api })
    await waitFor(() => expect(api.guide.get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('heading', { name: 'Primeiros passos' })).toBeNull()
  })
})
