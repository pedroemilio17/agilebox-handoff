import { describe, expect, it, vi } from 'vitest'
import { PermissionDeniedError, toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { createSaveDashboardSummary } from './save-dashboard-summary'

const manager: Actor = {
  userId: toUserId('00000000000000000000000004'),
  organizationId: toOrganizationId('00000000000000000000000001'),
  role: 'manager',
}
const input = { period: '2026-11-02', format: 'md' as const }
const summary = {
  filename: 'resumo-do-time-2026-11-04.md',
  mimeType: 'text/markdown; charset=utf-8',
  content: '# Resumo do time\n',
}

function setup(
  overrides: {
    dialog?: { canceled: boolean; filePath?: string }
    writeError?: boolean
    exportError?: Error
  } = {},
) {
  const calls: string[] = []
  const exportSummary = vi.fn(() => {
    calls.push('export')
    if (overrides.exportError) return Promise.reject(overrides.exportError)
    return Promise.resolve(summary)
  })
  const showSaveDialog = vi.fn(() => {
    calls.push('dialog')
    return Promise.resolve(
      overrides.dialog ?? { canceled: false, filePath: '/home/ana/Documentos/resumo.md' },
    )
  })
  const writeFile = vi.fn(() => {
    calls.push('write')
    if (overrides.writeError) return Promise.reject(new Error('EACCES: permission denied'))
    return Promise.resolve()
  })
  const save = createSaveDashboardSummary({ exportSummary, showSaveDialog, writeFile })
  return { save, exportSummary, showSaveDialog, writeFile, calls }
}

describe('dashboard.saveSummary (handler do processo principal)', () => {
  it('gera o resumo antes de abrir o diálogo e sugere o nome e o filtro do formato', async () => {
    const { save, exportSummary, showSaveDialog, calls } = setup()
    await save(manager, input)
    expect(calls.slice(0, 2)).toEqual(['export', 'dialog'])
    expect(exportSummary).toHaveBeenCalledWith(manager, input)
    expect(showSaveDialog).toHaveBeenCalledWith({
      defaultPath: 'resumo-do-time-2026-11-04.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
  })

  it('grava o conteúdo no local escolhido e devolve saved: true', async () => {
    const { save, writeFile } = setup()
    await expect(save(manager, input)).resolves.toEqual({ saved: true })
    expect(writeFile).toHaveBeenCalledWith('/home/ana/Documentos/resumo.md', '# Resumo do time\n')
  })

  it('completa a extensão quando o usuário digita o nome sem ela', async () => {
    const { save, writeFile } = setup({ dialog: { canceled: false, filePath: '/tmp/relatorio' } })
    await save(manager, { period: '2026-11-02', format: 'csv' })
    expect(writeFile).toHaveBeenCalledWith('/tmp/relatorio.csv', expect.any(String))
  })

  it('cancelar o diálogo devolve saved: false sem erro e sem gravar', async () => {
    const { save, writeFile } = setup({ dialog: { canceled: true } })
    await expect(save(manager, input)).resolves.toEqual({ saved: false })
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('erro de escrita vira erro tipado EXPORT_FAILED com mensagem curta', async () => {
    const { save } = setup({ writeError: true })
    await expect(save(manager, input)).rejects.toMatchObject({
      code: 'EXPORT_FAILED',
      message: 'Não foi possível salvar o arquivo.',
    })
  })

  it('colaborador não abre diálogo: o caso de uso recusa antes', async () => {
    const { save, showSaveDialog, writeFile } = setup({
      exportError: new PermissionDeniedError('Somente o gestor pode acessar o dashboard'),
    })
    await expect(save(manager, input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(showSaveDialog).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })
})
