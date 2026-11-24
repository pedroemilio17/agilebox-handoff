import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

afterEach(cleanup)

describe('Tooltip', () => {
  it('fica oculta por padrão e aparece quando solicitada', () => {
    const { rerender } = render(
      <Tooltip content="Projetos">
        <button type="button" aria-label="Projetos" />
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()

    rerender(
      <Tooltip content="Projetos" visible>
        <button type="button" aria-label="Projetos" />
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip').textContent).toContain('Projetos')
  })

  it('abre ao passar o mouse ou focar quando openOnHover está ativo', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Atalho rápido" openOnHover placement="bottom">
        <button type="button">Ajuda</button>
      </Tooltip>,
    )

    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.hover(screen.getByRole('button', { name: 'Ajuda' }))
    expect(screen.getByRole('tooltip').className).toContain('bottom')
    await user.unhover(screen.getByRole('button', { name: 'Ajuda' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
