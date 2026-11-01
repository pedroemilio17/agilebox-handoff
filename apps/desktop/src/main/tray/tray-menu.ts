export interface TrayMenuItem {
  readonly label: string
  readonly click: () => void
}

export interface TrayMenuHandlers {
  readonly openPanel: () => void
  readonly quit: () => void
}

export function buildTrayMenu(handlers: TrayMenuHandlers): readonly TrayMenuItem[] {
  return [
    { label: 'Abrir painel', click: handlers.openPanel },
    { label: 'Sair', click: handlers.quit },
  ]
}

/**
 * No Windows e no macOS fechar o painel o recolhe para o ícone da bandeja. No Linux o ícone só
 * aparece com extensões (GNOME) e pode não existir: fechar o painel encerra o aplicativo, para
 * nunca deixá-lo rodando sem como reabrir (decisão do Pedro; ver docs/laco/pendencias-do-pedro.md).
 */
export function shouldHideOnClose(platform: string): boolean {
  return platform !== 'linux'
}
