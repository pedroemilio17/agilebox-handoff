import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { KindBadge, RepeatMark } from './MeetingMarks'

afterEach(cleanup)

describe('KindBadge', () => {
  it.each([
    ['meeting', 'Reunião'],
    ['review', 'Revisão'],
    ['retro', 'Retro'],
  ] as const)('mostra o rótulo e o ícone do tipo %s', (kind, label) => {
    const { container } = render(<KindBadge kind={kind} />)

    expect(screen.getByText(label)).toBeTruthy()
    expect(container.querySelector(`[data-kind="${kind}"]`)).not.toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('RepeatMark', () => {
  it('expõe "Repete toda semana" como nome acessível', () => {
    render(<RepeatMark />)

    expect(screen.getByRole('img', { name: 'Repete toda semana' }).textContent).toBe('↻')
  })
})
