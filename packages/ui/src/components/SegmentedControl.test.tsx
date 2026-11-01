import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

afterEach(cleanup)

describe('SegmentedControl', () => {
  it('expõe as opções como botões nomeados e indica a seleção', () => {
    render(
      <SegmentedControl
        aria-label="Período"
        options={[
          { value: 'recent', label: 'Recentes' },
          { value: 'frequent', label: 'Frequentes' },
        ]}
        value="recent"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: 'Período' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recentes' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Frequentes' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(document.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it('permite selecionar uma opção pelo teclado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        aria-label="Projeto"
        options={[
          { value: 'one', label: 'Um' },
          { value: 'two', label: 'Dois' },
          { value: 'three', label: 'Três' },
        ]}
        value="one"
        onChange={onChange}
      />,
    )

    await user.tab()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('two')
  })
})
