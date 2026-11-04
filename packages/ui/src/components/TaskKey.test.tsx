import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TaskKey } from './TaskKey'

afterEach(cleanup)

describe('TaskKey', () => {
  it('mostra o ID como texto legível', () => {
    render(<TaskKey value="AB-118" />)
    expect(screen.getByText('AB-118')).toBeTruthy()
  })
})
