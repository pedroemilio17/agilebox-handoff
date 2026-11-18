import { describe, expect, it } from 'vitest'
import {
  createDeliverableInputSchema,
  createMilestoneInputSchema,
  moveDeliverableInputSchema,
  wbsViewDtoSchema,
} from './index'

const id = (n: number) => String(n).padStart(26, '0')

describe('contrato da EAP e dos marcos', () => {
  it('aceita título com espaços nas bordas e recusa título vazio ou longo demais', () => {
    expect(
      createDeliverableInputSchema.parse({ projectId: id(1), parentId: null, title: '  Infra  ' })
        .title,
    ).toBe('Infra')
    expect(() =>
      createDeliverableInputSchema.parse({ projectId: id(1), parentId: null, title: '   ' }),
    ).toThrow()
    expect(() =>
      createDeliverableInputSchema.parse({
        projectId: id(1),
        parentId: null,
        title: 'x'.repeat(201),
      }),
    ).toThrow()
  })

  it('posição negativa e id mal formado são recusados', () => {
    expect(() =>
      moveDeliverableInputSchema.parse({ deliverableId: id(2), parentId: null, position: -1 }),
    ).toThrow()
    expect(() =>
      moveDeliverableInputSchema.parse({ deliverableId: 'não-é-id', parentId: null, position: 0 }),
    ).toThrow()
  })

  it('marco: data no formato do calendário e critério de até 280 caracteres', () => {
    const base = { projectId: id(1), title: 'Marco', deliverableId: null, criterion: null }
    expect(() => createMilestoneInputSchema.parse({ ...base, dueOn: '2026-02-30x' })).toThrow()
    expect(createMilestoneInputSchema.parse({ ...base, dueOn: '2026-02-28' }).dueOn).toBe(
      '2026-02-28',
    )
    expect(() =>
      createMilestoneInputSchema.parse({
        ...base,
        dueOn: '2026-02-28',
        criterion: 'c'.repeat(281),
      }),
    ).toThrow()
  })

  it('a visão aceita custo nulo (quem não é gestor) e recusa nível 4', () => {
    const view = {
      projectId: id(1),
      canEdit: false,
      costEnabled: true,
      deliverables: [
        {
          kind: 'deliverable',
          id: id(2),
          parentId: null,
          code: '1',
          title: 'Fundação',
          level: 1,
          totals: { hours: 2, cost: null, progress: 50, tasks: 1, milestones: [] },
        },
      ],
      summary: { deliverables: 1, tasks: 1, hours: 2, cost: null, progress: 50 },
      milestones: [],
      tasksWithoutDeliverable: 0,
    }
    expect(wbsViewDtoSchema.parse(view).deliverables).toHaveLength(1)
    const tooDeep = { ...view, deliverables: [{ ...view.deliverables[0], level: 4 }] }
    expect(() => wbsViewDtoSchema.parse(tooDeep)).toThrow()
  })
})
