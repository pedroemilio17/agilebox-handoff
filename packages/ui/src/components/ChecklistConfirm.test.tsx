import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChecklistConfirm } from './ChecklistConfirm'

afterEach(cleanup)

const items = [
  { id: 'a', title: 'Testes passando' },
  { id: 'b', title: 'Revisado por par' },
]

describe('ChecklistConfirm', () => {
  it('mostra um checkbox com rótulo real por item', () => {
    render(
      <ChecklistConfirm
        label="Itens da definição de pronto"
        items={items}
        checkedIds={new Set()}
        onToggle={() => undefined}
      />,
    )

    expect(screen.getByRole('list', { name: 'Itens da definição de pronto' })).toBeTruthy()
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Testes passando' }).checked,
    ).toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Revisado por par' })).toBeTruthy()
  })

  it('reflete os ids marcados e avisa a troca com id e novo estado', async () => {
    const onToggle = vi.fn()
    render(
      <ChecklistConfirm
        label="Itens"
        items={items}
        checkedIds={new Set(['a'])}
        onToggle={onToggle}
      />,
    )

    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Testes passando' }).checked,
    ).toBe(true)
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Revisado por par' }))
    expect(onToggle).toHaveBeenCalledWith('b', true)
  })

  it('desabilita todos os checkboxes quando pedido', () => {
    render(
      <ChecklistConfirm
        label="Itens"
        items={items}
        checkedIds={new Set()}
        onToggle={() => undefined}
        disabled
      />,
    )

    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Testes passando' }).disabled,
    ).toBe(true)
  })
})
