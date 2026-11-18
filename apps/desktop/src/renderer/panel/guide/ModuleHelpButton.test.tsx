import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectModuleDto, ProjectModulesViewDto } from '@agilebox/contract'
import { renderPanel } from '../../shared/testing/render-panel'
import { createFakeApi, hiddenGuide } from '../../shared/testing/fake-api'
import { ImpedimentsView } from '../impediments/ImpedimentsView'
import { ModuleHelpButton } from './ModuleHelpButton'
import { GUIDE_PROJECT_ID } from './guide-fixtures'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mod(id: string, state: ProjectModuleDto['state'], level: ProjectModuleDto['level'] = 1) {
  return {
    id,
    name: id,
    level,
    objective: '',
    state,
    requires: [],
    enhances: [],
    config: null,
  } satisfies ProjectModuleDto
}

function modulesView(modules: readonly ProjectModuleDto[]): ProjectModulesViewDto {
  return { projectId: GUIDE_PROJECT_ID, modules: [...modules], canManage: false }
}

/** API com o estado de módulos e a experiência do guia, para o painel "Como funciona". */
function setup({
  modules = [mod('core', 'active', null), mod('backlog', 'active'), mod('sprints', 'disabled', 2)],
  experience = 'sometimes',
}: {
  readonly modules?: readonly ProjectModuleDto[]
  readonly experience?: 'never' | 'sometimes' | 'always'
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.projectModules, 'get').mockResolvedValue(modulesView(modules))
  vi.spyOn(api.guide, 'get').mockResolvedValue({ ...hiddenGuide(GUIDE_PROJECT_ID), experience })
  return api
}

describe('ModuleHelpButton', () => {
  it('não aparece sem projeto selecionado', () => {
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={null} />)
    expect(screen.queryByRole('button', { name: /como funciona/i })).toBeNull()
  })

  it('tem rótulo com o nome do módulo, aria-haspopup e aria-expanded', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup(),
    })
    const button = screen.getByRole('button', { name: 'Como funciona: Backlog' })
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await user.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('ModuleHelpPanel', () => {
  it('abre com o nome, nível, objetivo, por que existe e fluxo do manifesto', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup(),
    })
    await user.click(screen.getByRole('button', { name: 'Como funciona: Backlog' }))

    const dialog = screen.getByRole('dialog', { name: 'Backlog' })
    expect(within(dialog).getByText('N1 · essencial')).toBeTruthy()
    expect(within(dialog).getByText('Saber o que vem a seguir, em ordem.')).toBeTruthy()
    expect(within(dialog).getByText('Por que existe')).toBeTruthy()
    expect(
      within(dialog).getByText(
        'Sem ordem, a equipe escolhe pelo que parece mais fácil. O backlog mostra o que vem a seguir.',
      ),
    ).toBeTruthy()
    for (const step of ['Listar', 'Ordenar', 'Levar ao quadro']) {
      expect(within(dialog).getByText(step)).toBeTruthy()
    }
  })

  it('fecha com Esc e devolve o foco ao botão "?"', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup(),
    })
    const button = screen.getByRole('button', { name: 'Como funciona: Backlog' })
    await user.click(button)
    expect(screen.getByRole('dialog', { name: 'Backlog' })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('fecha pelo botão Fechar e devolve o foco ao botão "?"', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup(),
    })
    const button = screen.getByRole('button', { name: 'Como funciona: Backlog' })
    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('prende o foco dentro do painel enquanto estiver aberto', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup(),
    })
    await user.click(screen.getByRole('button', { name: 'Como funciona: Backlog' }))
    const dialog = screen.getByRole('dialog', { name: 'Backlog' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    for (let i = 0; i < 12; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('mostra Ligado ou Desligado conforme projectModules.get', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="sprints" projectId={GUIDE_PROJECT_ID} />, {
      api: setup({ modules: [mod('core', 'active', null), mod('backlog', 'active')] }),
    })
    await user.click(screen.getByRole('button', { name: 'Como funciona: Sprints' }))
    const dialog = screen.getByRole('dialog', { name: 'Sprints' })
    // Sprints requer Backlog: ligado.
    const requer = within(dialog).getByText('Backlog').closest('li')!
    expect(within(requer).getByText('Ligado')).toBeTruthy()
    // Estimativa em horas não está na lista: desligado.
    const aproveita = within(dialog).getByText('Estimativa em horas').closest('li')!
    expect(within(aproveita).getByText('Desligado')).toBeTruthy()
  })

  it('"Alimenta" é calculado dos manifestos (quem requer ou aproveita o módulo)', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup(),
    })
    await user.click(screen.getByRole('button', { name: 'Como funciona: Backlog' }))
    const dialog = screen.getByRole('dialog', { name: 'Backlog' })
    // Sprints requer Backlog: aparece em "Alimenta". Backlog aproveita Entregas (EAP): em "Aproveita".
    const alimenta = within(dialog).getByText('Sprints').closest('li')!
    expect(within(alimenta).getByText('Alimenta')).toBeTruthy()
    const aproveita = within(dialog).getByText('Entregas (EAP)').closest('li')!
    expect(within(aproveita).getByText('Aproveita')).toBeTruthy()
    const requer = within(dialog).getByText('Núcleo').closest('li')!
    expect(within(requer).getByText('Requer')).toBeTruthy()
  })

  it('mostra a experiência do guia do projeto', async () => {
    const user = userEvent.setup()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup({ experience: 'sometimes' }),
    })
    await user.click(screen.getByRole('button', { name: 'Como funciona: Backlog' }))
    await waitFor(() =>
      expect(screen.getByText('Seu guia: Algumas vezes, definido pelo projeto.')).toBeTruthy(),
    )
  })

  it('"Rever os primeiros passos" só aparece com onNavigate e leva ao quadro', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    renderPanel(<ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} />, {
      api: setup(),
    })
    await user.click(screen.getByRole('button', { name: 'Como funciona: Backlog' }))
    expect(screen.queryByRole('button', { name: 'Rever os primeiros passos' })).toBeNull()
    cleanup()

    renderPanel(
      <ModuleHelpButton moduleId="backlog" projectId={GUIDE_PROJECT_ID} onNavigate={onNavigate} />,
      { api: setup() },
    )
    await user.click(screen.getByRole('button', { name: 'Como funciona: Backlog' }))
    await user.click(screen.getByRole('button', { name: 'Rever os primeiros passos' }))
    expect(onNavigate).toHaveBeenCalledWith('projects')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('encaixe nas telas de módulo', () => {
  it('Impedimentos mostra o botão com o projeto selecionado e não sem ele', () => {
    renderPanel(<ImpedimentsView onOpenTask={vi.fn()} selectedProjectId={GUIDE_PROJECT_ID} />)
    expect(screen.getByRole('button', { name: 'Como funciona: Impedimentos' })).toBeTruthy()
    cleanup()

    renderPanel(<ImpedimentsView onOpenTask={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /como funciona/i })).toBeNull()
  })
})
