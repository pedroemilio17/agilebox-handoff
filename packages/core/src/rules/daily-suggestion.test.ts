import { describe, expect, it } from 'vitest'
import { createTask } from '../entities/task'
import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import type { Actor } from '../policies/actor'
import {
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import { ValidationError } from '../shared/errors'
import { parseDateOnly } from '../values/date-only'
import type { TaskStatus } from '../values/task-status'
import { suggestDailySummary } from './daily-suggestion'

const id = (n: number) => String(n).padStart(26, '0')
const ORG = toOrganizationId(id(1))
const OTHER_ORG = toOrganizationId(id(2))
const ANA = toUserId(id(10))
const BRUNO = toUserId(id(11))
const ana: Actor = { userId: ANA, organizationId: ORG, role: 'collaborator' }
const anaManager: Actor = { userId: ANA, organizationId: ORG, role: 'manager' }
const PREFIX = 'AB'
const DATE = parseDateOnly('2026-11-04')
const SAO_PAULO = 'America/Sao_Paulo' // UTC-3, sem horário de verão desde 2019
const NOON = '2026-11-04T15:00:00.000Z' // 12:00 em São Paulo

/** Tarefa criada por `creator`, que fica como responsável. Os campos extras vêm em `patch`. */
function aTask(number: number, title: string, creator = ANA, patch: Partial<Task> = {}): Task {
  const task = createTask({
    id: toTaskId(id(100 + number)),
    organizationId: ORG,
    number,
    projectId: toProjectId(id(1)),
    projectName: 'Projeto',
    createdBy: creator,
    title,
    createdAt: '2026-11-01T00:00:00.000Z',
    responsibleParticipationId: toParticipationId(id(200 + number)),
    responsibleRateCents: 4500,
  })
  return { ...task, ...patch }
}

let seq = 0
function eventOf(
  task: Task,
  at: string,
  type: string,
  payload: Record<string, unknown>,
  actorUserId = ANA,
): TimelineEvent {
  seq += 1
  return {
    id: toEventId(id(300 + seq)),
    taskId: task.id,
    at,
    actorUserId,
    asManager: false,
    type,
    payload,
  } as unknown as TimelineEvent
}

function move(task: Task, from: TaskStatus, to: TaskStatus, at = NOON, by = ANA) {
  return eventOf(task, at, 'status_changed', { before: from, after: to }, by)
}

function run(
  overrides: Partial<Parameters<typeof suggestDailySummary>[0]> & {
    tasks?: Task[]
    events?: TimelineEvent[]
  } = {},
) {
  return suggestDailySummary({
    actor: ana,
    tasks: [],
    events: [],
    date: DATE,
    timeZone: SAO_PAULO,
    prefix: PREFIX,
    ...overrides,
  })
}

describe('sugestão do check-in: tarefas movidas', () => {
  it('lista a tarefa movida com o estado de chegada, em pt-BR', () => {
    const task = aTask(12, 'Relatório')
    const result = run({
      tasks: [task],
      events: [
        move(task, 'todo', 'in_progress'),
        move(task, 'in_progress', 'review', '2026-11-04T16:00:00.000Z'),
      ],
    })
    expect(result.advanced).toEqual(['AB-12 Relatório: foi para Revisar'])
  })

  it('tarefa concluída entra como "foi para Concluído"', () => {
    const task = aTask(13, 'Publicar')
    const result = run({ tasks: [task], events: [move(task, 'review', 'done')] })
    expect(result.advanced).toEqual(['AB-13 Publicar: foi para Concluído'])
  })

  it('movimento que volta ao estado inicial no mesmo dia não conta', () => {
    const task = aTask(14, 'Ida e volta')
    const result = run({
      tasks: [task],
      events: [
        move(task, 'todo', 'in_progress', NOON),
        move(task, 'in_progress', 'todo', '2026-11-04T16:00:00.000Z'),
      ],
    })
    expect(result.advanced).toEqual([])
  })

  it('movimento feito por outra pessoa na tarefa do ator também conta', () => {
    const task = aTask(15, 'Compartilhada', ANA, {})
    const result = run({ tasks: [task], events: [move(task, 'todo', 'review', NOON, BRUNO)] })
    expect(result.advanced).toEqual(['AB-15 Compartilhada: foi para Revisar'])
  })
})

describe('sugestão do check-in: horas, bloqueio e comentários', () => {
  it('soma as horas lançadas pelo próprio ator na mesma linha do movimento', () => {
    const task = aTask(16, 'Com horas')
    const hours = eventOf(task, NOON, 'hours_changed', {
      participant: { kind: 'user', userId: ANA },
      before: 0,
      after: 250,
    })
    const result = run({ tasks: [task], events: [move(task, 'todo', 'review'), hours] })
    expect(result.advanced).toEqual(['AB-16 Com horas: foi para Revisar · lançou 2,5 h'])
  })

  it('horas de outra pessoa não entram na sugestão', () => {
    const task = aTask(17, 'Horas alheias')
    const hours = eventOf(task, NOON, 'hours_changed', {
      participant: { kind: 'user', userId: BRUNO },
      before: 0,
      after: 400,
    })
    expect(run({ tasks: [task], events: [hours] }).advanced).toEqual([])
  })

  it('bloqueio e desbloqueio vão para blockers, com o motivo', () => {
    const blocked = aTask(18, 'Parada')
    const freed = aTask(19, 'Liberada')
    const result = run({
      tasks: [blocked, freed],
      events: [
        eventOf(blocked, NOON, 'blocked', { reason: 'Aguardo o cliente' }),
        eventOf(freed, NOON, 'unblocked', { reason: 'Acesso' }),
      ],
    })
    expect(result.blockers).toEqual([
      'AB-18 Parada: bloqueada (Aguardo o cliente)',
      'AB-19 Liberada: desbloqueada',
    ])
  })

  it('bloqueio seguido de desbloqueio no mesmo dia vale o último evento', () => {
    const task = aTask(20, 'Idas e vindas')
    const result = run({
      tasks: [task],
      events: [
        eventOf(task, '2026-11-04T13:00:00.000Z', 'blocked', { reason: 'Rede' }),
        eventOf(task, '2026-11-04T14:00:00.000Z', 'unblocked', { reason: 'Rede' }),
      ],
    })
    expect(result.blockers).toEqual(['AB-20 Idas e vindas: desbloqueada'])
  })

  it('comentário do próprio ator em tarefa aberta vira próximo passo, com o status atual', () => {
    const task = aTask(21, 'Em curso', ANA, { status: 'in_progress' })
    const result = run({
      tasks: [task],
      events: [eventOf(task, NOON, 'comment_added', { commentId: id(9), excerpt: 'oi' })],
    })
    expect(result.nextCandidates).toEqual(['AB-21 Em curso: em Desenvolvendo'])
    expect(result.advanced).toEqual([])
  })

  it('comentário de outra pessoa não entra nos próximos passos', () => {
    const task = aTask(22, 'Comentada por outro', ANA, { status: 'todo' })
    const result = run({
      tasks: [task],
      events: [eventOf(task, NOON, 'comment_added', { commentId: id(9), excerpt: 'oi' }, BRUNO)],
    })
    expect(result.nextCandidates).toEqual([])
  })

  it('tarefa comentada que já entrou em advanced, blockers ou está concluída não repete em próximos passos', () => {
    const moved = aTask(23, 'Movida', ANA, { status: 'review' })
    const blocked = aTask(24, 'Bloqueada', ANA, { status: 'in_progress', blockedReason: 'Rede' })
    const done = aTask(25, 'Concluída', ANA, { status: 'done' })
    const result = run({
      tasks: [moved, blocked, done],
      events: [
        move(moved, 'in_progress', 'review'),
        eventOf(moved, NOON, 'comment_added', { commentId: id(9), excerpt: 'x' }),
        eventOf(blocked, NOON, 'comment_added', { commentId: id(8), excerpt: 'x' }),
        eventOf(done, NOON, 'comment_added', { commentId: id(7), excerpt: 'x' }),
      ],
    })
    expect(result.advanced).toEqual(['AB-23 Movida: foi para Revisar'])
    expect(result.nextCandidates).toEqual([])
  })
})

describe('sugestão do check-in: dia, fuso e virada', () => {
  it('sem eventos no dia, devolve listas vazias', () => {
    const task = aTask(30, 'Parada no tempo')
    expect(run({ tasks: [task], events: [] })).toEqual({
      advanced: [],
      nextCandidates: [],
      blockers: [],
    })
  })

  it('evento de outro dia não entra', () => {
    const task = aTask(31, 'De ontem')
    const yesterday = move(task, 'todo', 'review', '2026-11-03T15:00:00.000Z')
    expect(run({ tasks: [task], events: [yesterday] }).advanced).toEqual([])
  })

  it('a virada de dia segue o fuso do cliente, não o UTC', () => {
    // 02:30 UTC do dia 4 é 23:30 do dia 3 em São Paulo.
    const task = aTask(32, 'Virada')
    const late = move(task, 'todo', 'review', '2026-11-04T02:30:00.000Z')
    expect(run({ tasks: [task], events: [late] }).advanced).toEqual([])
    expect(
      run({ tasks: [task], events: [late], date: parseDateOnly('2026-11-03') }).advanced,
    ).toEqual(['AB-32 Virada: foi para Revisar'])
    expect(run({ tasks: [task], events: [late], date: DATE, timeZone: 'UTC' }).advanced).toEqual([
      'AB-32 Virada: foi para Revisar',
    ])
  })

  it('fuso inválido recusa, mesmo sem eventos', () => {
    expect(() => run({ timeZone: 'Marte/Olympus' })).toThrow(ValidationError)
  })
})

describe('sugestão do check-in: quem entra', () => {
  it('ignora tarefas de que o ator não participa', () => {
    const others = aTask(40, 'Só do Bruno', BRUNO)
    expect(run({ tasks: [others], events: [move(others, 'todo', 'review')] }).advanced).toEqual([])
  })

  it('o gestor vê só as tarefas em que participa, não o time', () => {
    const mine = aTask(41, 'Minha')
    const team = aTask(42, 'Do time', BRUNO)
    const result = run({
      actor: anaManager,
      tasks: [mine, team],
      events: [move(mine, 'todo', 'review'), move(team, 'todo', 'review')],
    })
    expect(result.advanced).toEqual(['AB-41 Minha: foi para Revisar'])
  })

  it('arquivada, de backlog e de outra organização ficam de fora', () => {
    const archived = aTask(43, 'Arquivada', ANA, { archivedAt: '2026-11-02T00:00:00.000Z' })
    const backlog = aTask(44, 'Backlog', ANA, { backlogRank: 1000 })
    const otherOrg = aTask(45, 'Outra empresa', ANA, { organizationId: OTHER_ORG })
    const result = run({
      tasks: [archived, backlog, otherOrg],
      events: [
        move(archived, 'todo', 'review'),
        move(backlog, 'todo', 'review'),
        move(otherOrg, 'todo', 'review'),
      ],
    })
    expect(result).toEqual({ advanced: [], nextCandidates: [], blockers: [] })
  })

  it('evento de tarefa que não veio na lista é ignorado', () => {
    const outside = aTask(46, 'Fora da lista')
    expect(run({ tasks: [], events: [move(outside, 'todo', 'review')] }).advanced).toEqual([])
  })

  it('ordem estável: pelo número da tarefa, não pela ordem dos eventos', () => {
    const later = aTask(51, 'Depois')
    const earlier = aTask(50, 'Antes')
    const result = run({
      tasks: [later, earlier],
      events: [
        move(later, 'todo', 'review', '2026-11-04T13:00:00.000Z'),
        move(earlier, 'todo', 'review', '2026-11-04T18:00:00.000Z'),
      ],
    })
    expect(result.advanced).toEqual([
      'AB-50 Antes: foi para Revisar',
      'AB-51 Depois: foi para Revisar',
    ])
  })
})
