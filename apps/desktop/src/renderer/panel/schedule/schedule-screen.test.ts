import { describe, expect, it } from 'vitest'
import {
  barLabel,
  barState,
  buildRows,
  buildTimeScale,
  compareTasks,
  conflictSummary,
  dayNumberOf,
  dependencyLines,
  fullDate,
  groupTasks,
  hasBar,
  isoOfDay,
  milestoneCenter,
  shortDate,
  todayCenter,
} from './schedule-screen'
import { DELIVERABLE_A, DELIVERABLE_B, dependency, scheduleTask, taskId } from './schedule-fixtures'
import { deliverableRow, wbsId, wbsView } from '../wbs/wbs-fixtures'

const RANGE = { start: '2026-11-02', end: '2027-01-30' }

describe('datas como dias', () => {
  it('ida e volta mantêm a data e dias consecutivos diferem de 1', () => {
    expect(isoOfDay(dayNumberOf('2026-11-02'))).toBe('2026-11-02')
    expect(dayNumberOf('2026-11-03') - dayNumberOf('2026-11-02')).toBe(1)
  })

  it('rótulos dd/mm e dd/mm/aaaa', () => {
    expect(shortDate('2026-11-02')).toBe('02/11')
    expect(fullDate('2027-01-30')).toBe('30/01/2027')
  })
})

describe('escala de semanas', () => {
  it('colunas começam na segunda com uma semana de margem antes e depois', () => {
    // 02/11/2026 é segunda; 30/01/2027 cai numa sexta, então a última segunda é 25/01.
    const scale = buildTimeScale(RANGE, 'weeks')
    expect(scale.columns.map((column) => column.label)).toEqual(
      expect.arrayContaining(['26/10', '02/11', '25/01']),
    )
    expect(isoOfDay(scale.start)).toBe('2026-10-26')
    expect(isoOfDay(scale.end)).toBe('2027-02-08')
    expect(scale.columns.every((column) => column.end - column.start === 7)).toBe(true)
  })

  it('posição de um dia fica entre 0 e 1 e cresce com a data', () => {
    const scale = buildTimeScale(RANGE, 'weeks')
    expect(scale.pos('2026-11-02')).toBeGreaterThan(0)
    expect(scale.pos('2026-11-02')).toBeLessThan(scale.pos('2026-12-01'))
    expect(scale.pos('2026-01-01')).toBe(0)
    expect(scale.pos('2030-01-01')).toBe(1)
  })

  it('intervalo de um dia ainda gera o eixo com margem', () => {
    const scale = buildTimeScale({ start: '2026-11-04', end: '2026-11-04' }, 'weeks')
    expect(scale.columns.length).toBeGreaterThanOrEqual(3)
    const center = scale.centerOf('2026-11-04')
    expect(center).not.toBeNull()
    expect(center!).toBeGreaterThan(0)
    expect(center!).toBeLessThan(1)
  })

  it('barra cobre os dias do início ao prazo, prazo incluído', () => {
    const scale = buildTimeScale(RANGE, 'weeks')
    const bar = scale.barGeometry('2026-11-02', '2026-11-08')
    // Sete dias num eixo de 105 dias (26/10 a 08/02): a largura é proporcional aos dias.
    const dayShare = 1 / (scale.end - scale.start)
    expect(bar.width).toBeCloseTo(7 * dayShare, 10)
    expect(bar.left).toBeCloseTo(7 * dayShare, 10)
  })
})

describe('escala de meses', () => {
  it('uma coluna por mês, com um mês de margem em cada ponta', () => {
    const scale = buildTimeScale(RANGE, 'months')
    expect(scale.columns.map((column) => column.label)).toEqual([
      'out/26',
      'nov/26',
      'dez/26',
      'jan/27',
      'fev/27',
    ])
  })
})

describe('hoje e marcos', () => {
  it('hoje dentro do eixo tem posição; fora dele não desenha', () => {
    const scale = buildTimeScale(RANGE, 'weeks')
    expect(todayCenter('2026-11-16', scale)).not.toBeNull()
    expect(todayCenter('2025-01-01', scale)).toBeNull()
    expect(todayCenter('2028-01-01', scale)).toBeNull()
  })

  it('marco fora do eixo não recebe posição', () => {
    const scale = buildTimeScale(RANGE, 'months')
    expect(
      milestoneCenter({ id: taskId('M1'), title: 'Virada', dueOn: '2030-01-01' }, scale),
    ).toBeNull()
    expect(
      milestoneCenter({ id: taskId('M2'), title: 'Virada', dueOn: '2026-12-18' }, scale),
    ).not.toBeNull()
  })
})

describe('estado da barra', () => {
  const today = '2026-11-16'
  it('concluída tem prioridade sobre o resto', () => {
    expect(
      barState(scheduleTask({ taskId: taskId('1'), done: true, deadline: '2026-11-01' }), today),
    ).toBe('done')
  })

  it('atrasada: prazo passou e não está concluída', () => {
    expect(barState(scheduleTask({ taskId: taskId('1'), deadline: '2026-11-10' }), today)).toBe(
      'late',
    )
  })

  it('em andamento: hoje entre início e prazo', () => {
    expect(
      barState(
        scheduleTask({ taskId: taskId('1'), startsOn: '2026-11-10', deadline: '2026-11-20' }),
        today,
      ),
    ).toBe('current')
  })

  it('futura: início ainda não chegou', () => {
    expect(
      barState(
        scheduleTask({ taskId: taskId('1'), startsOn: '2026-12-01', deadline: '2026-12-10' }),
        today,
      ),
    ).toBe('future')
  })

  it('sem as duas datas não há barra nem estado', () => {
    const task = scheduleTask({ taskId: taskId('1'), startsOn: null })
    expect(hasBar(task)).toBe(false)
    expect(barState(task, today)).toBeNull()
  })

  it('rótulo da barra traz o nome e as datas', () => {
    expect(
      barLabel(
        scheduleTask({
          taskId: taskId('1'),
          title: 'Cadastro',
          startsOn: '2026-11-02',
          deadline: '2026-11-14',
        }),
      ),
    ).toBe('Cadastro: início 02/11, prazo 14/11')
  })
})

describe('agrupamento', () => {
  const dated = scheduleTask({
    taskId: taskId('1'),
    key: 'ERP-2',
    title: 'B',
    startsOn: '2026-11-10',
    deadline: '2026-11-12',
  })
  const early = scheduleTask({
    taskId: taskId('2'),
    key: 'ERP-1',
    title: 'A',
    startsOn: '2026-11-02',
    deadline: '2026-11-05',
  })
  const undated = scheduleTask({
    taskId: taskId('3'),
    key: 'ERP-3',
    title: 'C',
    startsOn: null,
    deadline: null,
  })

  it('sem EAP, uma lista plana por início, sem data ao final', () => {
    const groups = groupTasks([dated, undated, early])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBeNull()
    expect(groups[0]?.tasks.map((task) => task.key)).toEqual(['ERP-1', 'ERP-2', 'ERP-3'])
  })

  it('com EAP, a ordem é a da EAP, entregas sem tarefas ficam de fora e "Sem entrega" vai ao final', () => {
    const wbs = wbsView([
      deliverableRow(DELIVERABLE_B, { code: '2', title: 'Migração' }),
      deliverableRow(DELIVERABLE_A, { code: '1', title: 'Configuração' }),
      deliverableRow(wbsId('C3'), { code: '3', title: 'Sem tarefas' }),
    ])
    const groups = groupTasks(
      [
        scheduleTask({ ...dated, deliverableId: DELIVERABLE_A }),
        scheduleTask({ ...early, deliverableId: DELIVERABLE_B }),
        undated,
      ],
      wbs,
    )
    expect(groups.map((group) => group.title)).toEqual(['Migração', 'Configuração', 'Sem entrega'])
    expect(groups.map((group) => group.code)).toEqual(['2', '1', null])
  })

  it('com EAP ligada mas sem entregas, a lista continua plana', () => {
    const groups = groupTasks([early, undated], wbsView([]))
    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBeNull()
  })

  it('compareTasks põe data antes de sem data', () => {
    expect(compareTasks(early, undated)).toBeLessThan(0)
    expect(compareTasks(undated, early)).toBeGreaterThan(0)
  })

  it('linhas: cabeçalho de entrega, tarefas recuadas e grupo Marcos por último', () => {
    const wbs = wbsView([deliverableRow(DELIVERABLE_A, { code: '1', title: 'Configuração' })])
    const groups = groupTasks([scheduleTask({ ...early, deliverableId: DELIVERABLE_A })], wbs)
    const rows = buildRows(groups, [{ id: taskId('M1'), title: 'Virada', dueOn: '2026-12-18' }])
    expect(rows.map((row) => row.kind)).toEqual(['group', 'task', 'group', 'milestone'])
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3])
    const task = rows[1]
    expect(task?.kind === 'task' && task.indented).toBe(true)
  })
})

describe('setas de dependência', () => {
  const scale = buildTimeScale(RANGE, 'weeks')
  const first = scheduleTask({
    taskId: taskId('1'),
    startsOn: '2026-11-02',
    deadline: '2026-11-08',
  })
  const second = scheduleTask({
    taskId: taskId('2'),
    startsOn: '2026-11-10',
    deadline: '2026-11-20',
  })
  const undated = scheduleTask({ taskId: taskId('3'), startsOn: null, deadline: null })
  const rows = buildRows(groupTasks([first, second, undated]), [])

  it('liga o fim da predecessora ao início da sucessora em ângulos retos', () => {
    const [line] = dependencyLines([dependency(first.taskId, second.taskId)], rows, scale)
    expect(line).toBeDefined()
    const [a, b, c, d] = line!.points
    expect(a.x).toBeCloseTo(
      scale.barGeometry('2026-11-02', '2026-11-08').left +
        scale.barGeometry('2026-11-02', '2026-11-08').width,
    )
    expect(d.x).toBeCloseTo(scale.pos('2026-11-10'))
    expect(a.y).toBe(0.5)
    expect(d.y).toBe(1.5)
    // Segmentos horizontais e verticais alternados.
    expect(a.y).toBe(b.y)
    expect(b.x).toBe(c.x)
    expect(c.y).toBe(d.y)
  })

  it('ignora dependência com tarefa sem barra', () => {
    expect(dependencyLines([dependency(first.taskId, undated.taskId)], rows, scale)).toEqual([])
  })

  it('mantém o marcador de conflito', () => {
    const [line] = dependencyLines([dependency(first.taskId, second.taskId, true)], rows, scale)
    expect(line?.conflict).toBe(true)
  })
})

describe('alerta de conflitos', () => {
  const a = scheduleTask({ taskId: taskId('1'), title: 'Integração bancária' })
  const b = scheduleTask({ taskId: taskId('2'), title: 'Configuração aprovada' })
  const c = scheduleTask({ taskId: taskId('3'), title: 'Módulo de estoque' })

  it('sem conflito, não há texto', () => {
    expect(conflictSummary([dependency(a.taskId, b.taskId)], [a, b])).toBeNull()
  })

  it('um conflito: texto no singular', () => {
    expect(conflictSummary([dependency(a.taskId, b.taskId, true)], [a, b])).toBe(
      '1 dependência com conflito: Integração bancária termina depois do início de Configuração aprovada',
    )
  })

  it('mais de um conflito: contagem e o primeiro par', () => {
    expect(
      conflictSummary(
        [dependency(a.taskId, b.taskId, true), dependency(c.taskId, b.taskId, true)],
        [a, b, c],
      ),
    ).toBe(
      '2 dependências com conflito: Integração bancária termina depois do início de Configuração aprovada',
    )
  })
})
