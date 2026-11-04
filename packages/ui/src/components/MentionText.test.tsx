import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MentionText } from './MentionText'

afterEach(cleanup)

const ANA = { id: '01J8Y4G2XK8Z1S6M3Q9W0A5V01', name: 'Ana Souza' }

describe('MentionText', () => {
  it('mostra o texto puro quando não há menções', () => {
    const { container } = render(<MentionText text="Bom dia, equipe" mentions={[]} />)
    expect(container.textContent).toBe('Bom dia, equipe')
    expect(container.querySelector('mark')).toBeNull()
  })

  it('destaca a menção com o texto real e o nome completo no título', () => {
    const { container } = render(<MentionText text="Oi @Ana Souza, veja isto" mentions={[ANA]} />)
    expect(container.textContent).toBe('Oi @Ana Souza, veja isto')
    const mark = screen.getByRole('mark', { name: '@Ana Souza' })
    expect(mark.textContent).toBe('@Ana Souza')
    expect(mark.getAttribute('title')).toBe('Ana Souza')
  })

  it('não destaca nomes que não estão na lista de menções', () => {
    const { container } = render(<MentionText text="@Ana Souza e @Bruno" mentions={[ANA]} />)
    expect(container.querySelectorAll('mark')).toHaveLength(1)
    expect(container.textContent).toBe('@Ana Souza e @Bruno')
  })

  it('escapa caracteres especiais e prefere o nome mais longo', () => {
    const marks = render(
      <MentionText
        text="@Ana (ops) e @Ana (ops) Souza"
        mentions={[
          { id: '01J8Y4G2XK8Z1S6M3Q9W0A5V02', name: 'Ana' },
          { id: '01J8Y4G2XK8Z1S6M3Q9W0A5V03', name: 'Ana (ops) Souza' },
          { id: '01J8Y4G2XK8Z1S6M3Q9W0A5V04', name: 'Ana (ops)' },
        ]}
      />,
    ).container.querySelectorAll('mark')
    expect(Array.from(marks).map((mark) => mark.textContent)).toEqual([
      '@Ana (ops)',
      '@Ana (ops) Souza',
    ])
  })
})
