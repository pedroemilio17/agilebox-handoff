import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeDetail } from '../task-detail/fixtures'
import { WeekCalendar, agendaDays } from './WeekCalendar'

afterEach(cleanup)
describe('agenda semanal', () => {
  it('mantém sete dias na virada de ano e um dia no modo diário', () => {
    expect(agendaDays('2027-01-01', 'week')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
    expect(agendaDays('2027-01-01', 'day')).toEqual(['2027-01-01'])
  })
  it('abre prazo da tarefa e posiciona evento com duração de uma hora, respeitando a permissão', async () => {
    const task = makeDetail({ deadline: '2026-11-02' })
    const event = {
      id: 'meeting',
      title: 'Revisão',
      date: '2026-11-02',
      time: '09:30',
      participants: [],
      createdBy: 'manager',
      createdAt: '',
      updatedAt: '',
    }
    const onOpenTask = vi.fn()
    const onEdit = vi.fn()
    const props = {
      days: agendaDays('2026-11-02', 'week'),
      today: '2026-11-02',
      selectedDate: '2026-11-02',
      meetings: [event, { ...event, id: 'early', time: '06:00', title: 'Reunião cedo' }],
      tasks: [task],
      showDeadlines: true,
      canEdit: true,
      onSelectDate: vi.fn(),
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onEdit,
      onOpenTask,
    }
    const { rerender } = render(<WeekCalendar {...props} />)
    expect(
      screen.getByRole('region', { name: 'Agendamentos fora da grade de 08–18' }).textContent,
    ).toContain('06:00 · Reunião cedo')
    const meeting = screen.getByRole('button', { name: 'Revisão, 09:30, duração de 1 hora' })
    expect(meeting.style.top).toBe('78px')
    expect(meeting.style.height).toBe('52px')
    await userEvent.click(meeting)
    expect(onEdit).toHaveBeenCalledWith(event)
    await userEvent.click(screen.getByRole('button', { name: `Abrir tarefa: ${task.title}` }))
    expect(onOpenTask).toHaveBeenCalledWith(task.id)
    rerender(<WeekCalendar {...props} canEdit={false} showDeadlines={false} />)
    expect(screen.queryByRole('button', { name: `Abrir tarefa: ${task.title}` })).toBeNull()
    expect(screen.getByRole('button', { name: /Revisão, 09:30/ }).hasAttribute('disabled')).toBe(
      true,
    )
  })
})
