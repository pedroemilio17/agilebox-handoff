import {
  ConflictError,
  renderDashboardSummary,
  renderDashboardSummaryCsv,
  formatDashboardPeriodLabel,
  selectDashboardPeriod,
  toDateOnly,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ExportDashboardSummaryInput, ExportDashboardSummaryOutput } from '@agilebox/contract'
import type { AppDeps } from '../../deps'
import { GetDashboard } from './get-dashboard'

/**
 * Resumo do dashboard para arquivo (B11). Usa a mesma consulta do dashboard (GetDashboard), então
 * a permissão (só gestor) e os números são os da tela. Quem grava o arquivo é o processo principal.
 */
export class ExportDashboardSummary {
  private readonly getDashboard: GetDashboard

  constructor(private readonly deps: AppDeps) {
    this.getDashboard = new GetDashboard(deps)
  }

  async execute(
    actor: Actor,
    input: ExportDashboardSummaryInput,
  ): Promise<ExportDashboardSummaryOutput> {
    const dashboard = await this.getDashboard.execute(actor)
    if (!dashboard.insights) throw new ConflictError('O dashboard ainda não tem dados')
    const insights = selectDashboardPeriod(dashboard.insights, input.period)
    const organization = await this.deps.organizations.findById(actor.organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const generatedAt = insights.updatedAt
    const date = toDateOnly(new Date(generatedAt), timeZone)
    const options = {
      generatedAt,
      periodLabel: formatDashboardPeriodLabel(input.period),
      organizationName: organization?.name ?? '',
      timeZone,
    }
    if (input.format === 'csv') {
      return {
        filename: `resumo-do-time-${date}.csv`,
        mimeType: 'text/csv; charset=utf-8',
        content: renderDashboardSummaryCsv(insights, { timeZone, bom: true }),
      }
    }
    return {
      filename: `resumo-do-time-${date}.md`,
      mimeType: 'text/markdown; charset=utf-8',
      content: renderDashboardSummary(insights, options),
    }
  }
}
