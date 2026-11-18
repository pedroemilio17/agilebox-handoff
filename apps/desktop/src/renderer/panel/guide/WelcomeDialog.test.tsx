import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuideViewDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { GuideCard } from './GuideCard'
import { WelcomeDialog } from './WelcomeDialog'
import { GUIDE_PROJECT_ID, makeGuide, WELCOME_AGIL } from './guide-fixtures'

afterEach(cleanup)

const DIALOG_NAME = 'Boas-vindas ao App de Chamados, Rita'

/** Igual ao App: o contador de pedidos vai da janela para o cartão. */
function Harness({ onSeeTrail }: { readonly onSeeTrail?: () => void }) {
  const [trailRequest, setTrailRequest] = useState(0)
  return (
    <>
      <GuideCard projectId={GUIDE_PROJECT_ID} onNavigate={vi.fn()} openRequest={trailRequest} />
      <WelcomeDialog
        projectId={GUIDE_PROJECT_ID}
        personName="Rita Souza"
        onSeeTrail={() => {
          onSeeTrail?.()
          setTrailRequest((count) => count + 1)
        }}
      />
    </>
  )
}

/**
 * Guia que some depois de gravar a resposta, como o servidor faz: a consulta seguinte devolve
 * `showWelcome` falso.
 */
function setupWelcome(
  options: {
    readonly guide?: GuideViewDto
    readonly failResolve?: boolean
    readonly failGet?: boolean
  } = {},
) {
  const api = createFakeApi()
  let current: GuideViewDto =
    options.guide ??
    makeGuide({
      doneCount: 0,
      showWelcome: true,
      welcome: WELCOME_AGIL,
      firstStepsCard: 'collapsed',
    })
  if (options.failGet) {
    vi.spyOn(api.guide, 'get').mockRejectedValue(new Error('falhou'))
  } else {
    vi.spyOn(api.guide, 'get').mockImplementation(() => Promise.resolve(current))
  }
  const resolve = vi.spyOn(api.guide, 'resolveWelcome').mockImplementation(() => {
    if (options.failResolve) return Promise.reject(new Error('gravação falhou'))
    current = { ...current, showWelcome: false, welcome: null }
    return Promise.resolve(undefined)
  })
  return { api, resolve }
}

function renderWelcome(options: Parameters<typeof setupWelcome>[0] = {}) {
  const setup = setupWelcome(options)
  const onSeeTrail = vi.fn()
  renderPanel(
    <WelcomeDialog projectId={GUIDE_PROJECT_ID} personName="Rita Souza" onSeeTrail={onSeeTrail} />,
    { api: setup.api },
  )
  return { ...setup, onSeeTrail }
}

describe('WelcomeDialog', () => {
  it('mostra projeto, pessoa, preset, contagem e a lista real da trilha', async () => {
    renderWelcome()
    const dialog = await screen.findByRole('dialog', { name: DIALOG_NAME })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(
      within(dialog).getByText('Este projeto começou como Ágil: 5 módulos ligados.'),
    ).not.toBeNull()
    expect(within(dialog).getByText('Quer ver a trilha de primeiros passos?')).not.toBeNull()
    expect(within(dialog).getByText('7 passos')).not.toBeNull()
    const steps = within(
      within(dialog).getByRole('list', { name: 'Passos da trilha' }),
    ).getAllByRole('listitem')
    expect(steps).toHaveLength(7)
    expect(steps[0]?.textContent).toContain('Liste o que precisa ser feito')
    expect(steps[0]?.textContent).toContain('Backlog')
    expect(within(dialog).getByText('Dá para abrir depois pelo ? de qualquer tela.')).not.toBeNull()
  })

  it('não aparece quando showWelcome é falso', async () => {
    const { api } = setupWelcome({
      guide: makeGuide({ doneCount: 0, showWelcome: false, welcome: null }),
    })
    renderPanel(
      <WelcomeDialog projectId={GUIDE_PROJECT_ID} personName="Rita Souza" onSeeTrail={vi.fn()} />,
      { api },
    )
    await waitFor(() => expect(api.guide.get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('não aparece no preset Simples, que não tem trilha', async () => {
    const guide: GuideViewDto = {
      ...makeGuide({ doneCount: 0, showWelcome: true }),
      trail: [],
      total: 0,
      currentKey: null,
      welcome: {
        projectName: 'App de Chamados',
        presetKey: 'simples',
        presetLabel: 'Simples',
        moduleCount: 0,
      },
    }
    const { api } = setupWelcome({ guide })
    renderPanel(
      <WelcomeDialog projectId={GUIDE_PROJECT_ID} personName="Rita Souza" onSeeTrail={vi.fn()} />,
      { api },
    )
    await waitFor(() => expect(api.guide.get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('"Agora não" grava a resposta, fecha e não abre o cartão', async () => {
    const user = userEvent.setup()
    const { api, resolve } = setupWelcome()
    const onSeeTrail = vi.fn()
    renderPanel(<Harness onSeeTrail={onSeeTrail} />, { api })
    await user.click(await screen.findByRole('button', { name: 'Agora não' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(resolve).toHaveBeenCalledWith({ projectId: GUIDE_PROJECT_ID })
    expect(onSeeTrail).not.toHaveBeenCalled()
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()
  })

  it('Esc tem o mesmo efeito de "Agora não"', async () => {
    const user = userEvent.setup()
    const { resolve, onSeeTrail } = renderWelcome()
    await screen.findByRole('dialog', { name: DIALOG_NAME })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(resolve).toHaveBeenCalledWith({ projectId: GUIDE_PROJECT_ID })
    expect(onSeeTrail).not.toHaveBeenCalled()
  })

  it('"Ver a trilha" grava, fecha e abre o cartão "Primeiros passos"', async () => {
    const user = userEvent.setup()
    const { api, resolve } = setupWelcome()
    const onSeeTrail = vi.fn()
    renderPanel(<Harness onSeeTrail={onSeeTrail} />, { api })
    expect(await screen.findByRole('heading', { name: 'Primeiros passos' })).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Passos do projeto' })).toBeNull()

    await user.click(await screen.findByRole('button', { name: 'Ver a trilha' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(resolve).toHaveBeenCalledWith({ projectId: GUIDE_PROJECT_ID })
    expect(onSeeTrail).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('list', { name: 'Passos do projeto' })).not.toBeNull()
  })

  it('o foco inicial vai para "Ver a trilha"', async () => {
    renderWelcome()
    await screen.findByRole('dialog', { name: DIALOG_NAME })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ver a trilha' }))
  })

  it('o foco fica preso na janela: Tab a partir do último volta ao primeiro', async () => {
    const user = userEvent.setup()
    renderWelcome()
    await screen.findByRole('dialog', { name: DIALOG_NAME })
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Agora não' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ver a trilha' }))
  })

  it('o véu não fecha a janela: é preciso responder', async () => {
    const user = userEvent.setup()
    const { resolve } = renderWelcome()
    const dialog = await screen.findByRole('dialog', { name: DIALOG_NAME })
    await user.click(dialog.parentElement as HTMLElement)
    expect(screen.getByRole('dialog', { name: DIALOG_NAME })).not.toBeNull()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('falha ao gravar a resposta reabre a janela com um aviso', async () => {
    const user = userEvent.setup()
    renderWelcome({ failResolve: true })
    await user.click(await screen.findByRole('button', { name: 'Agora não' }))
    expect(await screen.findByRole('alert')).not.toBeNull()
    expect(screen.getByRole('dialog', { name: DIALOG_NAME })).not.toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ver a trilha' }))
  })

  it('erro ao carregar o guia não mostra nada', async () => {
    const { api } = setupWelcome({ failGet: true })
    renderPanel(
      <WelcomeDialog projectId={GUIDE_PROJECT_ID} personName="Rita Souza" onSeeTrail={vi.fn()} />,
      { api },
    )
    await waitFor(() => expect(api.guide.get).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
