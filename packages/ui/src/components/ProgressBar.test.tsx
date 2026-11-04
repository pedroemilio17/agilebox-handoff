import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

afterEach(cleanup)

describe('ProgressBar', () => {
  it('é decorativa sem rótulo', () => {
    const { container } = render(<ProgressBar done={2} total={5} />)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('expõe progresso acessível com rótulo', () => {
    render(<ProgressBar done={2} total={5} label="Progresso das subtarefas" />)
    const bar = screen.getByRole('progressbar', { name: 'Progresso das subtarefas' })
    expect(bar.getAttribute('aria-valuenow')).toBe('2')
    expect(bar.getAttribute('aria-valuemax')).toBe('5')
    expect(bar.getAttribute('aria-valuetext')).toBe('2 de 5')
  })

  it('limita o preenchimento entre 0% e 100%', () => {
    const { container, rerender } = render(<ProgressBar done={9} total={5} />)
    expect((container.querySelector('span > span') as HTMLElement).style.width).toBe('100%')
    rerender(<ProgressBar done={-1} total={5} />)
    expect((container.querySelector('span > span') as HTMLElement).style.width).toBe('0%')
  })

  it('total zero fica vazia', () => {
    const { container } = render(<ProgressBar done={0} total={0} />)
    expect((container.querySelector('span > span') as HTMLElement).style.width).toBe('0%')
  })
})
