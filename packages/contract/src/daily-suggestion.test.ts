import { describe, expect, it } from 'vitest'
import { API_CHANNELS } from './channels'
import { API_SCHEMA_REGISTRY } from './api'
import { suggestDailySummaryInputSchema, suggestDailySummaryOutputSchema } from './daily'

describe('contrato: sugestão do check-in (daily.suggestSummary)', () => {
  it('é um canal da API com schema de entrada e de saída', () => {
    expect(API_CHANNELS).toContain('daily.suggestSummary')
    expect(API_SCHEMA_REGISTRY['daily.suggestSummary'].input).toBe(suggestDailySummaryInputSchema)
    expect(API_SCHEMA_REGISTRY['daily.suggestSummary'].output).toBe(suggestDailySummaryOutputSchema)
  })

  it('aceita data de calendário e fuso IANA', () => {
    expect(
      suggestDailySummaryInputSchema.parse({ date: '2026-11-04', timeZone: 'America/Sao_Paulo' }),
    ).toEqual({ date: '2026-11-04', timeZone: 'America/Sao_Paulo' })
  })

  it('descarta campos forjados: userId e organização não chegam pelo pedido', () => {
    const parsed = suggestDailySummaryInputSchema.parse({
      date: '2026-11-04',
      timeZone: 'UTC',
      userId: '00000000000000000000000099',
      organizationId: '00000000000000000000000098',
      tenantId: 'outro',
    })
    expect(parsed).toEqual({ date: '2026-11-04', timeZone: 'UTC' })
  })

  it('recusa data inválida, fuso ausente e fuso longo demais', () => {
    expect(() =>
      suggestDailySummaryInputSchema.parse({ date: '04/11/2026', timeZone: 'UTC' }),
    ).toThrow()
    expect(() => suggestDailySummaryInputSchema.parse({ date: '2026-11-04' })).toThrow()
    expect(() =>
      suggestDailySummaryInputSchema.parse({ date: '2026-11-04', timeZone: 'x'.repeat(65) }),
    ).toThrow()
  })

  it('saída tem as três listas de texto', () => {
    expect(
      suggestDailySummaryOutputSchema.parse({
        advanced: ['AB-1 A: foi para Revisar'],
        nextCandidates: [],
        blockers: [],
      }),
    ).toEqual({ advanced: ['AB-1 A: foi para Revisar'], nextCandidates: [], blockers: [] })
  })
})
