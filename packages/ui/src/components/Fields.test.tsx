import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { DateField, NumberField, TextArea, TextField } from './Fields'

afterEach(cleanup)

describe('Campos de formulário', () => {
  it('associa rótulos aos campos de texto, data e área de texto', () => {
    render(
      <>
        <TextField label="Título" />
        <TextArea label="Descrição" />
        <DateField label="Prazo" />
      </>,
    )

    expect(screen.getByRole('textbox', { name: 'Título' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toBeTruthy()
    expect(screen.getByLabelText('Prazo').getAttribute('type')).toBe('date')
  })

  it('aceita vírgula como separador decimal no campo numérico', async () => {
    const user = userEvent.setup()
    render(<NumberField label="Horas" />)
    const field = screen.getByRole('textbox', { name: 'Horas' })

    await user.type(field, '1,25')

    expect((field as HTMLInputElement).value).toBe('1,25')
    expect(field.getAttribute('inputmode')).toBe('decimal')
  })
})
