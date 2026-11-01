import { cleanup, render, screen } from '@testing-library/react'
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
})
