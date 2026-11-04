import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionCount } from './ActionCount'

afterEach(cleanup)

describe('ActionCount', () => {
  it('mostra "feitos/total" e expõe o nome acessível no plural', () => {
    render(<ActionCount done={2} total={3} />)
    const count = screen.getByRole('img', { name: '2 de 3 combinados feitos' })
    expect(count.textContent).toBe('2/3')
  })

  it('usa o singular para um combinado', () => {
    render(<ActionCount done={0} total={1} />)
    expect(screen.getByRole('img', { name: '0 de 1 combinado feito' }).textContent).toBe('0/1')
  })

  it('não aparece sem combinados', () => {
    const { container } = render(<ActionCount done={0} total={0} />)
    expect(container.textContent).toBe('')
  })
})
