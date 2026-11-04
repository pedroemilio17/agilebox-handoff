import { describe, expect, it } from 'vitest'
import {
  csvCell,
  formatDashboardPeriodLabel,
  isoWeekNumber,
  renderDashboardSummary,
  renderDashboardSummaryCsv,
  selectDashboardPeriod,
  type DashboardSummaryInsights,
} from './dashboard-summary'

const weeks = [
  { start: '2026-10-13', throughput: 1, cycleDays: 4, leadDays: 6, upToDatePercentage: 40 },
  { start: '2026-10-20', throughput: 0, cycleDays: null, leadDays: null, upToDatePercentage: 50 },
  { start: '2026-10-27', throughput: 2, cycleDays: 2.5, leadDays: 3, upToDatePercentage: 60 },
  { start: '2026-11-03', throughput: 3, cycleDays: 2.5, leadDays: null, upToDatePercentage: 72.4 },
]

function insights(overrides: Partial<DashboardSummaryInsights> = {}): DashboardSummaryInsights {
  return {
    updatedAt: '2026-11-04T14:26:00.000Z',
    weekStart: '2026-11-03',
    upToDatePercentage: 72.4,
    agingCount: 2,
    overdueCount: 1,
    blockedCount: 0,
    overWipColumns: [{ status: 'review', count: 4, limit: 3 }],
    cycleDays: 2.5,
    leadDays: null,
    throughput: 3,
    weeks,
    team: [
      {
        user: { name: 'Bruno Lima' },
        taskCount: 3,
        completedPercentage: 33,
        inProgress: 1,
        agingCount: 0,
        overdueCount: 1,
        blockedCount: 0,
        lastUpdatedAt: '2026-11-03T09:05:00.000Z',
      },
      {
        user: { name: 'Ana Souza' },
        taskCount: 4,
        completedPercentage: 50,
        inProgress: 2,
        agingCount: 2,
        overdueCount: 0,
        blockedCount: 0,
        lastUpdatedAt: null,
      },
    ],
    ...overrides,
  }
}

const options = {
  generatedAt: '2026-11-04T14:26:00.000Z',
  periodLabel: 'Semana 45 · 03/11–09/11/2026',
  organizationName: 'Equipe Aurora',
  timeZone: 'America/Sao_Paulo',
}

describe('renderDashboardSummary', () => {
  it('monta o Markdown em pt-BR com as seções e a data de geração no fuso informado', () => {
    const text = renderDashboardSummary(insights(), options)
    expect(text.startsWith('# Resumo do time\n')).toBe(true)
    expect(text).toContain('- **Organização:** Equipe Aurora')
    expect(text).toContain('- **Gerado em:** 04/11/2026 11:26')
    expect(text).toContain('- **Período:** Semana 45 · 03/11–09/11/2026')
    for (const heading of ['## Adesão', '## Exceções', '## Fluxo semanal', '## Equipe']) {
      expect(text).toContain(heading)
    }
  })

  it('usa os números recebidos, sem recalcular: arredonda só para exibir', () => {
    const text = renderDashboardSummary(insights(), options)
    expect(text).toContain('Quadro em dia: **72%**')
    expect(text).toContain('- Paradas (há mais de 4 dias em Desenvolvendo ou Revisar): 2')
    expect(text).toContain('- Vencidas (prazo de entrega passou): 1')
    expect(text).toContain('- Bloqueadas (com motivo registrado): 0')
    expect(text).toContain('- Tempo de ciclo médio: 2,5d')
    expect(text).toContain('- Concluídas nesta semana: 3')
  })

  it('mostra "—" para valores ausentes e "nenhuma" quando não há coluna acima do limite', () => {
    const text = renderDashboardSummary(
      insights({ upToDatePercentage: null, cycleDays: null, overWipColumns: [] }),
      { ...options, organizationName: '' },
    )
    expect(text).toContain('- **Organização:** —')
    expect(text).toContain('Quadro em dia: **—**')
    expect(text).toContain('- Tempo de ciclo médio: —')
    expect(text).toContain('- Colunas acima do limite de WIP: nenhuma')
    expect(text).toContain('| 45 | 03/11 | 3 | 2,5d | — | 72% |')
  })

  it('lista as colunas acima do limite com rótulo, contagem e limite', () => {
    const text = renderDashboardSummary(
      insights({
        overWipColumns: [
          { status: 'review', count: 4, limit: 3 },
          { status: 'in_progress', count: 2, limit: 1 },
        ],
      }),
      options,
    )
    expect(text).toContain('- Colunas acima do limite de WIP: Desenvolvendo (2/1); Revisar (4/3)')
  })

  it('ordena a equipe por nome em pt-BR e escapa a barra vertical nos nomes', () => {
    const text = renderDashboardSummary(
      insights({
        team: [
          ...insights().team,
          {
            ...insights().team[0]!,
            user: { name: 'Álvaro | Teste' },
          },
        ],
      }),
      options,
    )
    const row = text.split('\n').find((line) => line.includes('Álvaro'))
    expect(row).toContain('Álvaro \\| Teste')
    expect(text.indexOf('Ana Souza')).toBeGreaterThan(text.indexOf('Álvaro'))
    expect(text.indexOf('Ana Souza')).toBeLessThan(text.indexOf('Bruno Lima'))
  })

  it('diz que não há tarefas quando a equipe está vazia', () => {
    expect(renderDashboardSummary(insights({ team: [] }), options)).toContain(
      'Nenhuma tarefa ainda.',
    )
  })
})

describe('renderDashboardSummaryCsv', () => {
  it('tem uma linha por pessoa com as colunas pedidas, sem valores de custo', () => {
    const csv = renderDashboardSummaryCsv(insights(), { timeZone: 'America/Sao_Paulo' })
    expect(csv).toBe(
      [
        'Nome,Itens,Concluído %,Paradas,Vencidas,Bloqueadas,Última atualização',
        'Ana Souza,4,50,2,0,0,—',
        'Bruno Lima,3,33,0,1,0,03/11/2026 06:05',
        '',
      ].join('\r\n'),
    )
    expect(csv).not.toMatch(/R\$|custo/i)
  })

  it('põe BOM UTF-8 quando pedido, para o Excel reconhecer acentos', () => {
    const csv = renderDashboardSummaryCsv(insights(), { timeZone: 'UTC', bom: true })
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).startsWith('Nome,')).toBe(true)
    expect(renderDashboardSummaryCsv(insights(), { timeZone: 'UTC' }).startsWith('Nome,')).toBe(
      true,
    )
  })

  it('escapa vírgula, aspas e quebra de linha nos nomes', () => {
    const csv = renderDashboardSummaryCsv(
      insights({
        team: [
          {
            ...insights().team[0]!,
            user: { name: 'Silva, "Zé"\nJúnior' },
          },
        ],
      }),
      { timeZone: 'UTC' },
    )
    expect(csv).toContain('"Silva, ""Zé""\nJúnior",3,33,0,1,0,')
  })

  it('preserva acentuação e devolve só o cabeçalho quando não há equipe', () => {
    const csv = renderDashboardSummaryCsv(insights({ team: [] }), { timeZone: 'UTC' })
    expect(csv).toBe('Nome,Itens,Concluído %,Paradas,Vencidas,Bloqueadas,Última atualização\r\n')
  })
})

describe('csvCell', () => {
  it('não entrecerra campos simples e usa "—" para vazio', () => {
    expect(csvCell('Ana')).toBe('Ana')
    expect(csvCell('')).toBe('—')
    expect(csvCell('   ')).toBe('—')
  })

  it('entre aspas quando há vírgula, aspas ou quebra de linha', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"')
  })
})

describe('período', () => {
  it('seleciona a semana escolhida nos campos de topo, como a tela', () => {
    const selected = selectDashboardPeriod(insights(), '2026-10-27')
    expect(selected.weekStart).toBe('2026-10-27')
    expect(selected.upToDatePercentage).toBe(60)
    expect(selected.throughput).toBe(2)
    expect(selected.leadDays).toBe(3)
    expect(selected.cycleDays).toBe(2.5)
  })

  it('recusa uma semana que não está no dashboard', () => {
    expect(() => selectDashboardPeriod(insights(), '2026-09-01')).toThrow(
      'Semana fora do dashboard',
    )
  })

  it('rotula o período no padrão do seletor e calcula a semana ISO', () => {
    expect(formatDashboardPeriodLabel('2026-11-03')).toBe('Semana 45 · 03/11–09/11/2026')
    expect(isoWeekNumber('2026-01-01')).toBe(1)
    expect(isoWeekNumber('2027-01-03')).toBe(53)
    expect(isoWeekNumber('2026-12-28')).toBe(53)
  })
})
