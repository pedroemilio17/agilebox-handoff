import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { DateField, NumberField, SelectField, TextArea, TextField } from './Fields'

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

  it('associa rótulo e permite selecionar opções em SelectField', async () => {
    const user = userEvent.setup()
    render(
      <SelectField
        label="Projeto"
        defaultValue="p1"
        options={[
          { value: 'p1', label: 'AgileBox' },
          { value: 'p2', label: 'Portal' },
        ]}
      />,
    )

    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Projeto' })
    expect(select.value).toBe('p1')
    await user.selectOptions(select, 'p2')
    expect(select.value).toBe('p2')
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
