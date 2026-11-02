import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { CostCard } from './CostCard'
import { makeDetail } from './fixtures'

afterEach(cleanup)

/** Renderiza o cartão e devolve `redraw`, que muda só `showHours` (como a troca de nível faz). */
function renderCard(showHours: boolean) {
  const api = createFakeApi()
  const task = makeDetail()
  const tree = (hours: boolean) => (
    <ApiProvider api={api}>
      <QueryProvider>
        <CostCard task={task} readOnly={false} showHours={hours} showRate />
      </QueryProvider>
    </ApiProvider>
  )
  const view = render(tree(showHours))
  return {
    user: userEvent.setup(),
    redraw: (hours: boolean) => view.rerender(tree(hours)),
  }
}

describe('CostCard', () => {
  it('ao esconder as horas, descarta o rascunho e mostra de novo as horas gravadas', async () => {
    const { user, redraw } = renderCard(true)
    const hours = screen.getByLabelText('Horas de Ana Souza')
    await user.clear(hours)
    await user.type(hours, '3,5')

    redraw(false)
    expect(screen.queryByLabelText('Horas de Ana Souza')).toBeNull()

    redraw(true)
    expect(screen.getByLabelText('Horas de Ana Souza')).toHaveValue('2,5')
  })

  it('sem a estimativa, o subtotal e o total usam as horas gravadas, não o rascunho', async () => {
    const { user, redraw } = renderCard(true)
    const hours = screen.getByLabelText('Horas de Ana Souza')
    await user.clear(hours)
    await user.type(hours, '3,5')
    expect(screen.getByLabelText('Total').textContent).toBe('R$\u00a0140,00')

    redraw(false)

    expect(screen.getByLabelText('Total').textContent).toBe('R$\u00a0100,00')
  })
})
