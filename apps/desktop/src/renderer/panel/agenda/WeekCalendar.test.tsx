import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeetingOccurrenceDto } from '@agilebox/contract'
import { makeDetail } from '../task-detail/fixtures'
import { WeekCalendar, agendaDays } from './WeekCalendar'

afterEach(cleanup)

const occurrence = (
  overrides: Partial<MeetingOccurrenceDto> & Pick<MeetingOccurrenceDto, 'id' | 'time'>,
): MeetingOccurrenceDto => ({
  title: 'Revisão',
  date: '2026-11-02',
  endTime: null,
  kind: 'meeting',
  recurrence: 'none',
  recurrenceUntil: null,
  participants: [],
  createdBy: 'manager',
  createdAt: '',
  updatedAt: '',
  seriesId: overrides.id,
  occurrenceDate: '2026-11-02',
  occurrenceIndex: 0,
  occurrenceEndTime: addHour(overrides.time),
  retroActionsCount: 0,
  retroActionsDone: 0,
  ...overrides,
})

function addHour(time: string) {
  return `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}${time.slice(2)}`
}

const baseProps = {
  days: agendaDays('2026-11-02', 'week'),
  today: '2026-11-02',
  selectedDate: '2026-11-02',
  tasks: [],
  showDeadlines: false,
  canEdit: true,
  onSelectDate: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onEdit: vi.fn(),
  onOpenTask: vi.fn(),
}

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

  it('abre prazo da tarefa e posiciona evento pela duração, respeitando a permissão', async () => {
    const task = makeDetail({ deadline: '2026-11-02' })
    const event = occurrence({ id: 'meeting', time: '09:30', title: 'Revisão de entrega' })
    const onOpenTask = vi.fn()
    const onEdit = vi.fn()
    const props = {
      ...baseProps,
      meetings: [event, occurrence({ id: 'early', time: '06:00', title: 'Reunião cedo' })],
      tasks: [task],
      showDeadlines: true,
      onEdit,
      onOpenTask,
    }
    const { rerender } = render(<WeekCalendar {...props} />)
    expect(
      screen.getByRole('region', { name: 'Agendamentos fora da grade de 08–18' }).textContent,
    ).toContain('06:00 · Reunião cedo')
    const meeting = screen.getByRole('button', {
      name: 'Revisão de entrega, Reunião, 09:30 às 10:30',
    })
    expect(meeting.style.top).toBe('78px')
    expect(meeting.style.height).toBe('52px')
    await userEvent.click(meeting)
    expect(onEdit).toHaveBeenCalledWith(event)
    await userEvent.click(screen.getByRole('button', { name: `Abrir tarefa: ${task.title}` }))
    expect(onOpenTask).toHaveBeenCalledWith(task.id)
    rerender(<WeekCalendar {...props} canEdit={false} showDeadlines={false} meetings={[event]} />)
    expect(screen.queryByRole('button', { name: `Abrir tarefa: ${task.title}` })).toBeNull()
    expect(
      screen
        .getByRole<HTMLButtonElement>('button', { name: /Revisão de entrega/ })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('ocupa do início ao fim (52 px por hora) e usa 1 hora quando não há fim', () => {
    render(
      <WeekCalendar
        {...baseProps}
        meetings={[
          occurrence({ id: 'longa', time: '09:00', occurrenceEndTime: '11:30', title: 'Longa' }),
          occurrence({ id: 'sem-fim', time: '13:00', title: 'Sem fim' }),
        ]}
      />,
    )
    const longa = screen.getByRole('button', { name: /^Longa, Reunião, 09:00 às 11:30/ })
    expect(longa.style.top).toBe('52px')
    expect(longa.style.height).toBe('130px')
    const semFim = screen.getByRole('button', { name: /^Sem fim, Reunião, 13:00 às 14:00/ })
    expect(semFim.style.height).toBe('52px')
  })

  it('rotula cada tipo com texto além da cor e marca séries com ↻', () => {
    render(
      <WeekCalendar
        {...baseProps}
        meetings={[
          occurrence({ id: 'r', time: '09:00', kind: 'review', title: 'Entrega' }),
          occurrence({
            id: 't',
            time: '11:00',
            kind: 'retro',
            title: 'Retro',
            recurrence: 'weekly',
          }),
        ]}
      />,
    )
    const review = screen.getByRole('button', { name: /^Entrega, Revisão/ })
    expect(within(review).getByText('Revisão')).toBeTruthy()
    expect(review.className).toContain('evReview')
    const retro = screen.getByRole('button', {
      name: 'Retro, Retro, 11:00 às 12:00, repete toda semana',
    })
    expect(within(retro).getByRole('img', { name: 'Repete toda semana' })).toBeTruthy()
    expect(retro.className).toContain('evRetro')
  })

  it('mostra a mesma série em cada dia em que ela cai', () => {
    const series = occurrence({
      id: 'serie',
      time: '09:00',
      title: 'Alinhamento',
      recurrence: 'weekly',
    })
    render(
      <WeekCalendar
        {...baseProps}
        meetings={[
          { ...series, occurrenceDate: '2026-11-02' },
          { ...series, occurrenceDate: '2026-11-04' },
        ]}
      />,
    )
    const names = screen.getAllByRole('button', { name: /^Alinhamento, Reunião/ })
    expect(names).toHaveLength(2)
    expect(names[0]?.parentElement).not.toBe(names[1]?.parentElement)
  })
})
