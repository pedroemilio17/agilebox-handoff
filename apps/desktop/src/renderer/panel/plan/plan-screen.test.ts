import { describe, expect, it } from 'vitest'
import {
  buildPlanModel,
  buildSprintContext,
  dayNumber,
  dominantDeliverable,
  sprintDayText,
} from './plan-screen'
import {
  DELIVERABLE_1,
  DELIVERABLE_2,
  PLAN_TODAY,
  SPRINT_1,
  SPRINT_2,
  SPRINT_3,
  planExample,
  sprintFixture,
} from './plan-fixtures'
import { deliverableRow, wbsId, wbsView } from '../wbs/wbs-fixtures'

describe('dayNumber', () => {
  it('mede a distância em dias de calendário, sem fuso', () => {
    expect(dayNumber('2026-11-18') - dayNumber('2026-11-17')).toBe(1)
    expect(dayNumber('2026-12-01') - dayNumber('2026-11-01')).toBe(30)
  })
})

describe('buildPlanModel', () => {
  const example = planExample()
  const model = buildPlanModel({ ...example, today: PLAN_TODAY })

  it('desenha a escala de novembro a dezembro, com a linha de hoje dentro dela', () => {
    expect(model.timeline).not.toBeNull()
    expect(model.timeline?.months.map((month) => month.label)).toEqual(['nov', 'dez'])
    expect(model.timeline?.months[0]?.left).toBe(0)
    expect(model.timeline?.today).toBeGreaterThan(0)
    expect(model.timeline?.today).toBeLessThan(100)
  })

  it('põe cada sprint no tempo pelas datas planejadas, com o estado da sprint', () => {
    expect(model.sprints.map((chip) => [chip.label, chip.status])).toEqual([
      ['S1', 'closed'],
      ['S2', 'active'],
      ['S3', 'draft'],
    ])
    const [first, second] = model.sprints
    expect(second!.left).toBeGreaterThan(first!.left)
  })

  it('faixa da entrega vai da primeira à última sprint com itens dela', () => {
    const bar = model.bars.find((item) => item.id === DELIVERABLE_1)
    expect(bar?.label).toBe('1 · Acesso e perfil')
    expect(bar?.meta).toBe('03/11 – 28/11 · 58%')
    expect(bar?.current).toBe(true)
  })

  it('entregas que se sobrepõem no tempo vão para linhas diferentes', () => {
    const lanes = model.bars.map((bar) => bar.lane)
    expect(new Set(lanes).size).toBe(2)
    expect(model.laneCount).toBe(2)
  })

  it('uma entrega sem nenhuma sprint não tem faixa no tempo', () => {
    const wbs = wbsView([
      deliverableRow(DELIVERABLE_1, { code: '1', title: 'Sem sprint' }),
      deliverableRow(DELIVERABLE_2, { code: '2', title: 'Também sem sprint' }),
    ])
    const plan = buildPlanModel({ wbs, sprints: [], itemsById: {}, today: PLAN_TODAY })
    expect(plan.bars).toEqual([])
    expect(plan.timeline).toBeNull()
  })

  it('marcos vão na escala pela data de entrega', () => {
    expect(model.milestones.map((mark) => [mark.title, mark.date])).toEqual([
      ['Acesso no ar', '28/11'],
    ])
  })

  it('a entrega atual é a primeira que não chegou a 100%, com as sprints que a atravessam', () => {
    expect(model.current?.label).toBe('1 · Acesso e perfil')
    expect(model.current?.progress).toBe(58)
    expect(model.current?.sprints).toEqual([
      { sprintId: SPRINT_1, number: 1, text: 'Concluída · 8 h' },
      { sprintId: SPRINT_2, number: 2, text: 'Em andamento · termina no marco' },
    ])
  })

  it('marco da entrega atual mostra o dia da semana pelo calendário real', () => {
    // 28/11/2026 é sábado no calendário real (o design diz sexta: divergência registrada).
    expect(model.current?.milestone).toBe('Acesso no ar · sáb 28/11 · 10 dias')
  })

  it('falta na entrega soma os itens não concluídos e suas horas', () => {
    expect(model.current?.remaining).toEqual({ items: 3, hours: 14 })
  })

  it('próximas entregas trazem os itens que faltam e quantos não têm estimativa', () => {
    expect(model.next).toEqual([
      expect.objectContaining({
        label: '2 · Matrícula online',
        description: '2 itens, 0 sem estimativa',
      }),
    ])
  })

  it('próxima entrega sem itens mostra o texto do design', () => {
    const wbs = wbsView([
      deliverableRow(DELIVERABLE_1, { code: '1', title: 'Atual', progress: 10 }),
      deliverableRow(DELIVERABLE_2, { code: '2', title: 'Vazia', progress: 0 }),
    ])
    const plan = buildPlanModel({ wbs, sprints: [], itemsById: {}, today: PLAN_TODAY })
    expect(plan.next[0]?.description).toBe(
      'Só a entrega e o marco, sem itens ainda. No híbrido isso é normal: o detalhe chega perto da hora.',
    )
  })

  it('o botão "Abrir Sprint" usa a sprint ativa e a entrega que ela mais tem', () => {
    expect(model.activeSprint).toEqual({
      id: SPRINT_2,
      number: 2,
      deliverableId: DELIVERABLE_1,
    })
  })

  it('sem sprint ativa não há botão de sprint', () => {
    const plan = buildPlanModel({
      ...example,
      sprints: example.sprints.map((sprint) => ({ ...sprint, status: 'draft' as const })),
      today: PLAN_TODAY,
    })
    expect(plan.activeSprint).toBeNull()
  })

  it('sem entrega em andamento, o cartão atual fica vazio', () => {
    const wbs = wbsView([
      deliverableRow(DELIVERABLE_1, { code: '1', title: 'Pronta', progress: 100 }),
    ])
    const plan = buildPlanModel({ wbs, sprints: [], itemsById: {}, today: PLAN_TODAY })
    expect(plan.current).toBeNull()
  })
})

describe('dominantDeliverable', () => {
  it('escolhe a entrega com mais itens e, no empate, a primeira da EAP', () => {
    const { wbs, itemsById } = planExample()
    const tree = {
      topLevel: wbs.deliverables.filter(
        (row): row is Extract<typeof row, { kind: 'deliverable' }> =>
          row.kind === 'deliverable' && row.parentId === null,
      ),
      topOf: (id: string | null) => id,
    }
    expect(dominantDeliverable(itemsById[SPRINT_2] ?? [], tree)).toBe(DELIVERABLE_1)
    expect(dominantDeliverable([], tree)).toBeNull()
  })
})

describe('sprintDayText', () => {
  it('mostra o dia útil de hoje dentro da sprint ativa', () => {
    const sprint = sprintFixture({
      id: SPRINT_2,
      number: 2,
      status: 'active',
      plannedStart: '2026-11-17',
      plannedEnd: '2026-11-28',
    })
    // 17 e 18 são dias úteis; a sprint tem 9 (28/11 cai num sábado, no calendário real).
    expect(sprintDayText(sprint, '2026-11-18')).toBe('dia 2 de 9')
  })

  it('não mostra dia para sprint que não está ativa', () => {
    const sprint = sprintFixture({ id: SPRINT_3, number: 3, status: 'draft' })
    expect(sprintDayText(sprint, PLAN_TODAY)).toBeNull()
  })
})

describe('buildSprintContext', () => {
  const example = planExample()
  const sprint = example.sprints[1]!
  const items = example.itemsById[SPRINT_2] ?? []
  const context = buildSprintContext({
    wbs: example.wbs,
    sprint,
    sprints: example.sprints,
    itemsById: example.itemsById,
    items,
    deliverableId: DELIVERABLE_1,
    today: PLAN_TODAY,
  })

  it('mostra a entrega aberta, o progresso e as sprints dela', () => {
    expect(context.deliverable).toMatchObject({
      code: '1',
      title: 'Acesso e perfil',
      progress: 58,
      sprintsText: 'S1, S2',
    })
  })

  it('marco da entrega diz quando cai no mesmo dia do fim da sprint', () => {
    expect(context.deliverable?.milestone).toBe(
      'Acesso no ar · sáb 28/11 · mesmo dia do fim da sprint',
    )
  })

  it('cada item leva o selo da entrega dele', () => {
    expect(context.items.map((entry) => [entry.item.id, entry.tag, entry.outside])).toEqual([
      [wbsId('402'), 'E1', false],
      [wbsId('403'), 'E1', false],
      [wbsId('406'), 'E2', true],
    ])
  })

  it('o item de outra entrega aparece como fora da entrega', () => {
    expect(context.outside.map((item) => item.id)).toEqual([wbsId('406')])
  })

  it('soma as horas estimadas da sprint e traz a meta e o dia', () => {
    expect(context.hours).toBe(17)
    expect(context.goal).toBe('Aluno entra e edita o próprio perfil')
    expect(context.dayText).toBe('dia 2 de 9')
  })

  it('sem entrega, todo item fica fora da entrega, mas sem alerta', () => {
    const none = buildSprintContext({
      wbs: example.wbs,
      sprint,
      sprints: example.sprints,
      itemsById: example.itemsById,
      items,
      deliverableId: null,
      today: PLAN_TODAY,
    })
    expect(none.deliverable).toBeNull()
    expect(none.outside).toEqual([])
    expect(none.items.every((entry) => entry.outside)).toBe(true)
  })
})
