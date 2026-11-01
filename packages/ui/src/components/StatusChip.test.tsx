import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusChip } from './StatusChip'

afterEach(cleanup)

describe('StatusChip', () => {
  it.each([
    ['planning', 'Planejamento'],
    ['todo', 'A fazer'],
    ['in_progress', 'Desenvolvendo'],
    ['review', 'Revisar'],
    ['done', 'Concluído'],
  ] as const)('mostra o rótulo textual do estado %s', (status, label) => {
    render(<StatusChip status={status} />)
    expect(screen.getByText(label).getAttribute('data-status')).toBe(status)
  })
})
