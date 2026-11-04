import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CommentCount } from './CommentCount'

afterEach(cleanup)

describe('CommentCount', () => {
  it('mostra o número e o nome acessível no plural', () => {
    render(<CommentCount count={3} />)
    expect(screen.getByRole('img', { name: '3 comentários' }).textContent).toBe('3')
  })

  it('usa o singular para um comentário', () => {
    render(<CommentCount count={1} />)
    expect(screen.getByRole('img', { name: '1 comentário' })).toBeTruthy()
  })

  it('não aparece sem comentários', () => {
    const { container } = render(<CommentCount count={0} />)
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).toBeNull()
  })
})
