import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEAM_MODULE_IDS } from '@agilebox/contract'
import { parseDateOnly } from '@agilebox/core'
import { Drawer } from '@agilebox/ui'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { UndoProvider } from '../layout/UndoProvider'
import { makeDetail, TASK_ID } from './fixtures'
import { TaskDetailView } from './TaskDetailView'

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

/**
 * Aviso de desfazer (role=status). O subtotal de custo é um `output`, que tem o mesmo papel
 * implícito: por isso o aviso é achado pelo texto e não só pelo papel.
 */
async function findToast(text: string): Promise<HTMLElement> {
  const element = await screen.findByText(text)
  const toast = element.closest<HTMLElement>('[role="status"]')
  if (!toast) throw new Error(`"${text}" não está dentro de um aviso`)
  return toast
}

interface SetupOptions {
  readonly detail?: ReturnType<typeof makeDetail>
  readonly inDrawer?: boolean
  /** Controles ao lado do detalhe, por exemplo a barra lateral ou um botão de outra tela. */
  readonly extra?: ReactNode
}

function setup({ detail = makeDetail(), inDrawer = false, extra }: SetupOptions = {}) {
  const api = createFakeApi()
  vi.spyOn(api.teamModules, 'get').mockResolvedValue({
    level: 'advanced',
    screens: [],
    statuses: TEAM_MODULE_IDS.map((moduleId) => ({ moduleId, state: 'active' })),
  })
  vi.spyOn(api.tasks, 'get').mockResolvedValue(detail)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  const update = vi.spyOn(api.tasks, 'update').mockResolvedValue(detail)
  const archive = vi.spyOn(api.tasks, 'archive').mockResolvedValue(detail)
  const unarchive = vi.spyOn(api.tasks, 'unarchive').mockResolvedValue(detail)
  const onBack = vi.fn()
  const onClose = vi.fn()
  const view = (
    <TaskDetailView taskId={TASK_ID} onBack={onBack} today={parseDateOnly('2026-11-01')} />
  )
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <UndoProvider>
          {extra}
          {inDrawer ? (
            <Drawer open title="Revisar integração" onClose={onClose}>
              {view}
            </Drawer>
          ) : (
            view
          )}
        </UndoProvider>
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, update, archive, unarchive, onBack, onClose, user: userEvent.setup() }
}

describe('renomear no lugar', () => {
  it('Enter grava o título novo e sai da edição', async () => {
    const { update, user } = setup()
    const title = await screen.findByLabelText('Título da tarefa')
    await user.click(title)
    await user.clear(title)
    await user.type(title, 'Título novo')

    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ taskId: TASK_ID, changes: { title: 'Título novo' } }),
    )
    expect(title).not.toHaveFocus()
  })

  it('Esc cancela: volta ao título gravado, não grava e não fecha o detalhe', async () => {
    const { update, onClose, user } = setup({ inDrawer: true })
    const title = await screen.findByLabelText('Título da tarefa')
    await user.click(title)
    await user.clear(title)
    await user.type(title, 'Descartado')

    await user.keyboard('{Escape}')

    expect(title).toHaveValue('Revisar integração')
    expect(update).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Esc sem mudança no título segue e fecha o detalhe', async () => {
    const { onClose, user } = setup({ inDrawer: true })
    const title = await screen.findByLabelText('Título da tarefa')
    await user.click(title)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('F2 leva o foco ao título com o texto selecionado, mesmo sem foco no título', async () => {
    const { user } = setup()
    const title = await screen.findByLabelText('Título da tarefa')
    expect(document.body).toHaveFocus()

    await user.keyboard('{F2}')

    expect(title).toHaveFocus()
    const field = title as HTMLInputElement
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length])
  })

  it('F2 não inicia a edição em tarefa somente leitura', async () => {
    const { user } = setup({
      detail: makeDetail({ canEdit: false, readOnly: true }),
    })
    await screen.findByText('Somente leitura')

    await user.keyboard('{F2}')

    expect(screen.getByLabelText('Título da tarefa')).not.toHaveFocus()
  })

  it('F2 dentro de outro campo não tira o foco dele', async () => {
    const { user } = setup()
    const description = await screen.findByLabelText('Descrição')
    await user.click(description)

    await user.keyboard('{F2}')

    expect(description).toHaveFocus()
  })
})

describe('menu de ações e arquivar', () => {
  it('o botão ⋯ tem nome acessível e o menu traz Arquivar com o atalho E', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Mais ações da tarefa' }))

    const menu = screen.getByRole('menu', { name: 'Ações da tarefa' })
    const archive = screen.getByRole('menuitem', { name: /Arquivar/ })
    expect(menu).toContainElement(archive)
    expect(archive).toHaveTextContent('E')
  })

  it('o menu abre pelo teclado, Enter arquiva e o foco não fica preso', async () => {
    const { archive, onBack, user } = setup()
    const trigger = await screen.findByRole('button', { name: 'Mais ações da tarefa' })
    trigger.focus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('menuitem', { name: /Arquivar/ })).toHaveFocus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(archive).toHaveBeenCalledWith({ taskId: TASK_ID }))
    expect(onBack).toHaveBeenCalled()
  })

  it('Esc fecha o menu sem fechar o detalhe e devolve o foco ao ⋯', async () => {
    const { onClose, user } = setup({ inDrawer: true })
    const trigger = await screen.findByRole('button', { name: 'Mais ações da tarefa' })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('arquivar mostra o aviso com Desfazer, fecha o detalhe e não pede confirmação', async () => {
    const { archive, onBack, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Mais ações da tarefa' }))

    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))

    await waitFor(() => expect(archive).toHaveBeenCalledWith({ taskId: TASK_ID }))
    expect(onBack).toHaveBeenCalled()
    expect(await findToast('Tarefa “Revisar integração” arquivada')).toHaveTextContent('Desfazer')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Desfazer no aviso devolve a tarefa pela API', async () => {
    const { unarchive, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Mais ações da tarefa' }))
    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))
    const toast = await findToast('Tarefa “Revisar integração” arquivada')

    await user.click(toast.querySelector('button') as HTMLButtonElement)

    await waitFor(() => expect(unarchive).toHaveBeenCalledWith({ taskId: TASK_ID }))
  })

  it('Ctrl Z devolve a tarefa arquivada', async () => {
    const { unarchive, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Mais ações da tarefa' }))
    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))
    await findToast('Tarefa “Revisar integração” arquivada')

    await user.keyboard('{Control>}z{/Control}')

    await waitFor(() => expect(unarchive).toHaveBeenCalledWith({ taskId: TASK_ID }))
  })

  it('a tecla E arquiva quando o foco não está em campo de texto', async () => {
    const { archive, user } = setup()
    await screen.findByLabelText('Título da tarefa')

    await user.keyboard('e')

    await waitFor(() => expect(archive).toHaveBeenCalledWith({ taskId: TASK_ID }))
  })

  it('a tecla E não arquiva enquanto se digita no título', async () => {
    const { archive, user } = setup()
    const title = await screen.findByLabelText('Título da tarefa')
    await user.click(title)

    await user.keyboard('e')

    expect(archive).not.toHaveBeenCalled()
  })

  it('em tarefa somente leitura não há ⋯ e E não arquiva', async () => {
    const { archive, user } = setup({ detail: makeDetail({ canEdit: false, readOnly: true }) })
    await screen.findByText('Somente leitura')
    expect(screen.queryByRole('button', { name: 'Mais ações da tarefa' })).toBeNull()

    fireEvent.keyDown(document.body, { key: 'e' })
    await user.keyboard('e')

    expect(archive).not.toHaveBeenCalled()
  })

  it('se arquivar falha, mostra o erro e não fecha o detalhe', async () => {
    const { archive, onBack, user } = setup()
    archive.mockRejectedValueOnce(new Error('falhou'))
    await user.click(await screen.findByRole('button', { name: 'Mais ações da tarefa' }))

    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.queryByText('Tarefa “Revisar integração” arquivada')).toBeNull()
  })
})

describe('atalhos e menu com outros controles na tela (M2.12-fix)', () => {
  it('F2 que outro controle já tratou (defaultPrevented) não leva o foco ao título', async () => {
    const { user } = setup({
      extra: (
        <button
          type="button"
          onKeyDown={(event) => {
            if (event.key === 'F2') event.preventDefault()
          }}
        >
          Renomear projeto
        </button>
      ),
    })
    const title = await screen.findByLabelText('Título da tarefa')
    const other = screen.getByRole('button', { name: 'Renomear projeto' })
    other.focus()

    await user.keyboard('{F2}')

    expect(title).not.toHaveFocus()
    expect(other).toHaveFocus()
  })

  it('F2 e E com foco na barra lateral não agem no detalhe', async () => {
    const { archive, user } = setup({
      extra: (
        <nav aria-label="Navegação principal">
          <button type="button">Início</button>
        </nav>
      ),
    })
    const title = await screen.findByLabelText('Título da tarefa')
    screen.getByRole('button', { name: 'Início' }).focus()

    await user.keyboard('{F2}')
    expect(title).not.toHaveFocus()

    await user.keyboard('e')
    expect(archive).not.toHaveBeenCalled()
  })

  it('Shift+E não arquiva: só E puro', async () => {
    const { archive, user } = setup()
    await screen.findByLabelText('Título da tarefa')

    await user.keyboard('{Shift>}E{/Shift}')

    expect(archive).not.toHaveBeenCalled()
  })

  it('clicar fora fecha o menu e a tecla E volta a arquivar', async () => {
    const { archive, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Mais ações da tarefa' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByRole('menu')).toBeNull()

    await user.keyboard('e')

    await waitFor(() => expect(archive).toHaveBeenCalledWith({ taskId: TASK_ID }))
  })

  it('o foco indo para fora do menu o fecha', async () => {
    const { user } = setup({ extra: <button type="button">Fora</button> })
    await user.click(await screen.findByRole('button', { name: 'Mais ações da tarefa' }))

    act(() => screen.getByRole('button', { name: 'Fora' }).focus())

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('clicar de novo no ⋯ aberto fecha o menu', async () => {
    const { user } = setup()
    const trigger = await screen.findByRole('button', { name: 'Mais ações da tarefa' })
    await user.click(trigger)

    await user.click(trigger)

    expect(screen.queryByRole('menu')).toBeNull()
  })
})
