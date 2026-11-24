import type { DashboardDto } from '@agilebox/contract'

export type Insights = NonNullable<DashboardDto['insights']>

export const BRUNO = '01HZBRUNO0000000000000000A'
export const ANA = '01HZANA00000000000000000B'
export const CHAMADOS = '01HZPROJCHAMADOS00000000A'
export const ERP = '01HZPROJERP000000000000000B'

/** Insights completos para os testes do dashboard. Cada teste sobrescreve o que precisa. */
export function insightsFixture(overrides: Partial<Insights> = {}): Insights {
  return {
    updatedAt: '2026-11-04T12:00:00Z',
    weekStart: '2026-11-02',
    upToDatePercentage: 75,
    agingCount: 1,
    overdueCount: 1,
    blockedCount: 1,
    overWipColumns: [{ status: 'in_progress', count: 4, limit: 3 }],
    cycleDays: 3,
    leadDays: 5,
    throughput: 2,
    weeks: [
      { start: '2026-11-02', throughput: 2, cycleDays: 3, leadDays: 5, upToDatePercentage: 75 },
    ],
    projects: [
      {
        id: CHAMADOS,
        name: 'App de Chamados',
        method: 'agil',
        health: 'attention',
        healthReason: '1 tarefa parada há mais de 4 dias',
        kpi: {
          kind: 'sprint',
          sprint: {
            number: 4,
            day: 7,
            totalDays: 10,
            remainingHours: 30,
            endsOn: '2026-11-12',
          },
        },
        trend: { reference: [40, 30, 20, 10], actual: [40, 34, 26, null] },
      },
      {
        id: ERP,
        name: 'Implantação ERP',
        method: 'tradicional',
        health: 'risk',
        healthReason: '1 tarefa vencida',
        kpi: {
          kind: 'progress',
          percent: 34,
          done: 9,
          total: 26,
          week: { current: 3, total: 13 },
          spentCost: 9630,
          baselineDeviationDays: 2,
        },
        trend: null,
      },
    ],
    needs: [
      {
        id: `wip:${CHAMADOS}:in_progress`,
        kind: 'wip',
        projectId: CHAMADOS,
        projectName: 'App de Chamados',
        taskId: null,
        text: 'Desenvolvendo está com 4 de 3.',
        at: '2026-11-04T10:40:00Z',
      },
      {
        id: `milestone:01HZMILESTONE000000000000A`,
        kind: 'milestone',
        projectId: ERP,
        projectName: 'Implantação ERP',
        taskId: null,
        text: 'Integração bancária está em risco: vence em 7 dias.',
        at: null,
      },
      {
        id: `acceptance:01HZTASKAB140000000000000`,
        kind: 'acceptance',
        projectId: CHAMADOS,
        projectName: 'App de Chamados',
        taskId: '01HZTASKAB140000000000000',
        text: 'AB-140 foi concluída sem “Texto de ajuda atualizado”.',
        at: '2026-11-04T09:20:00Z',
      },
    ],
    updates: [
      {
        id: '01HZUPDATE00000000000000001',
        taskId: '01HZTASKAB151000000000000',
        taskTitle: 'Estimativa do módulo de chamados',
        projectId: CHAMADOS,
        projectName: 'App de Chamados',
        projectMethod: 'agil',
        actorUserId: ANA,
        actorName: 'Ana Souza',
        asManager: false,
        at: '2026-11-04T08:47:00Z',
        category: 'estimate',
        text: 'alterou a estimativa de 12 h para 14 h',
      },
      {
        id: '01HZUPDATE00000000000000002',
        taskId: '01HZTASKAB151000000000000',
        taskTitle: 'Estimativa do módulo de chamados',
        projectId: CHAMADOS,
        projectName: 'App de Chamados',
        projectMethod: 'agil',
        actorUserId: ANA,
        actorName: 'Ana Souza',
        asManager: false,
        at: '2026-11-04T08:02:00Z',
        category: 'status',
        text: 'moveu de A fazer para Desenvolvendo',
      },
      {
        id: '01HZUPDATE00000000000000003',
        taskId: '01HZTASKERP000000000000001',
        taskTitle: 'Configuração aprovada',
        projectId: ERP,
        projectName: 'Implantação ERP',
        projectMethod: 'tradicional',
        actorUserId: BRUNO,
        actorName: 'Bruno Lima',
        asManager: true,
        at: '2026-11-03T16:30:00Z',
        category: 'deadline',
        text: 'alterou o prazo de 10/11 para 18/11',
      },
    ],
    recentChanges: [],
    team: [
      {
        user: { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator' as const },
        projects: [
          { id: CHAMADOS, name: 'App de Chamados' },
          { id: ERP, name: 'Implantação ERP' },
        ],
        taskCount: 3,
        completedPercentage: 25,
        inProgress: 2,
        agingCount: 1,
        overdueCount: 0,
        blockedCount: 1,
        lastUpdatedAt: '2026-11-04T10:00:00Z',
        staleDays: 3,
        overdueDays: null,
        acceptancePendingCount: 0,
        loadHours: 26,
      },
      {
        user: { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator' as const },
        projects: [{ id: CHAMADOS, name: 'App de Chamados' }],
        taskCount: 2,
        completedPercentage: 0,
        inProgress: 1,
        agingCount: 0,
        overdueCount: 0,
        blockedCount: 0,
        lastUpdatedAt: '2026-11-04T09:00:00Z',
        staleDays: null,
        overdueDays: 7,
        acceptancePendingCount: 1,
        loadHours: 14,
      },
    ],
    ...overrides,
  }
}

export function dashboardFixture(
  insights: Insights = insightsFixture(),
  distribution: DashboardDto['distribution'] = {
    planning: 0,
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  },
): DashboardDto {
  return {
    insights,
    distribution,
    collaborators: [],
  }
}
