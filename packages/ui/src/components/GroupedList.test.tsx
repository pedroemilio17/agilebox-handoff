import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FieldRow, GroupedList } from './GroupedList'

afterEach(cleanup)

describe('GroupedList e FieldRow', () => {
  it('agrupa campos nomeados e apresenta a linha de 48 px', () => {
    render(
      <GroupedList aria-label="Detalhes">
        <FieldRow label="Prazo">
          <span>Hoje</span>
        </FieldRow>
      </GroupedList>,
    )

    expect(screen.getByRole('group', { name: 'Detalhes' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Prazo' })).toBeTruthy()
    expect(screen.getByText('Hoje')).toBeTruthy()
  })
})
