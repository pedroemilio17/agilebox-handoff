import type { Actor } from '@agilebox/core'
import { ExportFailedError } from '@agilebox/core'
import type {
  ExportDashboardSummaryInput,
  ExportDashboardSummaryOutput,
  SaveDashboardSummaryOutput,
} from '@agilebox/contract'

/** Mesmo formato de `dialog.showSaveDialog` do Electron (arrays mutáveis, como a tipagem exige). */
export interface SaveDialogOptions {
  defaultPath: string
  filters: { name: string; extensions: string[] }[]
}

/** Portas do handler: o caso de uso, o diálogo nativo e a gravação. Injetadas para teste. */
export interface SaveSummaryDeps {
  readonly exportSummary: (
    actor: Actor,
    input: ExportDashboardSummaryInput,
  ) => Promise<ExportDashboardSummaryOutput>
  readonly showSaveDialog: (
    options: SaveDialogOptions,
  ) => Promise<{ readonly canceled: boolean; readonly filePath?: string | undefined }>
  readonly writeFile: (path: string, content: string) => Promise<void>
}

const FILTERS: Record<'md' | 'csv', { name: string; extensions: string[] }[]> = {
  md: [{ name: 'Markdown', extensions: ['md'] }],
  csv: [{ name: 'Planilha CSV', extensions: ['csv'] }],
}

/**
 * Gera o resumo pelo caso de uso (permissão do gestor antes de abrir qualquer diálogo), pede o local
 * ao usuário e grava. Cancelar devolve `saved: false`; falha de escrita vira erro tipado curto.
 */
export function createSaveDashboardSummary(deps: SaveSummaryDeps) {
  return async (
    actor: Actor,
    input: ExportDashboardSummaryInput,
  ): Promise<SaveDashboardSummaryOutput> => {
    const summary = await deps.exportSummary(actor, input)
    const dialog = await deps.showSaveDialog({
      defaultPath: summary.filename,
      filters: FILTERS[input.format].map((filter) => ({
        name: filter.name,
        extensions: [...filter.extensions],
      })),
    })
    if (dialog.canceled || !dialog.filePath) return { saved: false }
    const extension = `.${input.format}`
    const filePath = dialog.filePath.toLowerCase().endsWith(extension)
      ? dialog.filePath
      : `${dialog.filePath}${extension}`
    try {
      await deps.writeFile(filePath, summary.content)
    } catch {
      throw new ExportFailedError('Não foi possível salvar o arquivo.')
    }
    return { saved: true }
  }
}
