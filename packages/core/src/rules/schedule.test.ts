import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toProjectId, toTaskId } from '../shared/ids'
import type { TaskId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { assertDependency, dependencyConflict, scheduleGuideEvent } from './schedule'

const ulid = (n: number) => String(n).padStart(26, '0')
const project = toProjectId(ulid(2))
const otherProject = toProjectId(ulid(3))
const task = (n: number, projectId = project) => ({ id: toTaskId(ulid(n)), projectId })
const edge = (predecessor: TaskId, successor: TaskId) => ({
  predecessorId: predecessor,
  successorId: successor,
})
const day = (value: string) => parseDateOnly(value)

describe('assertDependency', () => {
  const a = task(10)
  const b = task(11)
  const c = task(12)

  it('aceita dependência válida entre tarefas do mesmo projeto', () => {
    expect(() => assertDependency(a, b, [])).not.toThrow()
  })

  it('recusa a própria tarefa', () => {
    expect(() => assertDependency(a, a, [])).toThrow('Tarefa não pode depender de si mesma')
  })

  it('recusa tarefa de outro projeto', () => {
    expect(() => assertDependency(a, task(11, otherProject), [])).toThrow(
      'As tarefas precisam ser do mesmo projeto',
    )
    expect(() => assertDependency(a, task(11, otherProject), [])).toThrow(ValidationError)
  })

  it('recusa duplicata exata', () => {
    expect(() => assertDependency(a, b, [edge(a.id, b.id)])).toThrow('Esta dependência já existe')
  })

  it('recusa ciclo direto (b depende de a, agora a depende de b)', () => {
    expect(() => assertDependency(b, a, [edge(a.id, b.id)])).toThrow(
      'Esta dependência criaria um ciclo entre as tarefas',
    )
  })

  it('recusa ciclo indireto por cadeia (a→b→c, agora c→a)', () => {
    const chain = [edge(a.id, b.id), edge(b.id, c.id)]
    expect(() => assertDependency(c, a, chain)).toThrow('ciclo')
  })

  it('aceita a aresta que não fecha laço, mesmo com outras existentes (bifurcação)', () => {
    const d = task(13)
    expect(() => assertDependency(a, c, [edge(a.id, b.id), edge(b.id, d.id)])).not.toThrow()
    expect(() => assertDependency(c, b, [edge(a.id, b.id), edge(a.id, c.id)])).not.toThrow()
  })
})

describe('dependencyConflict', () => {
  it('há conflito quando o término da predecessora passa do início da sucessora', () => {
    expect(
      dependencyConflict({ deadline: day('2026-05-10') }, { startsOn: day('2026-05-09') }),
    ).toBe(true)
  })

  it('início igual ao término não é conflito, nem início depois dele', () => {
    expect(
      dependencyConflict({ deadline: day('2026-05-10') }, { startsOn: day('2026-05-10') }),
    ).toBe(false)
    expect(
      dependencyConflict({ deadline: day('2026-05-10') }, { startsOn: day('2026-05-11') }),
    ).toBe(false)
  })

  it('sem uma das datas não há conflito', () => {
    expect(dependencyConflict({ deadline: null }, { startsOn: day('2026-05-01') })).toBe(false)
    expect(dependencyConflict({ deadline: day('2026-05-10') }, { startsOn: null })).toBe(false)
  })
})

describe('scheduleGuideEvent', () => {
  const none = { startsOn: null, deadline: null }
  const start = { startsOn: day('2026-05-01'), deadline: null }
  const both = { startsOn: day('2026-05-01'), deadline: day('2026-05-10') }

  it('conclui o passo quando a tarefa fica com início e prazo e uma das datas muda', () => {
    expect(scheduleGuideEvent(start, both)).toBe('task.scheduled')
    expect(scheduleGuideEvent(none, both)).toBe('task.scheduled')
    expect(scheduleGuideEvent(both, { ...both, deadline: day('2026-05-12') })).toBe(
      'task.scheduled',
    )
  })

  it('não conclui sem as duas datas, nem quando nada mudou', () => {
    expect(scheduleGuideEvent(none, start)).toBeNull()
    expect(scheduleGuideEvent(both, both)).toBeNull()
  })
})
