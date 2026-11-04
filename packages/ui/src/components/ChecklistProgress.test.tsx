import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChecklistProgress } from './ChecklistProgress'

afterEach(cleanup)

describe('ChecklistProgress', () => {
  it('mostra a contagem em texto', () => {
    render(<ChecklistProgress done={2} total={5} />)
    expect(screen.getByText('2/5')).toBeTruthy()
  })

  it('não aparece sem subtarefas', () => {
    const { container } = render(<ChecklistProgress done={0} total={0} />)
    expect(container.textContent).toBe('')
  })
})
