import type { GuideProgressEntry } from '@agilebox/application'
import type { guideProgress } from '../schema/index.js'

type GuideProgressRow = typeof guideProgress.$inferSelect

/** Linha de `guide_progress` para o tipo da porta. A chave da linha não vai junto: é a do pedido. */
export function mapGuideProgressRow(row: GuideProgressRow): GuideProgressEntry {
  return {
    stepKey: row.stepKey,
    doneAt: row.doneAt,
    dismissed: row.dismissed,
  }
}
