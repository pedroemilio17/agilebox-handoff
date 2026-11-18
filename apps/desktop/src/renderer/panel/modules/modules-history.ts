import type { ProjectModuleEventDto } from '@agilebox/contract'

/**
 * Texto de uma mudança do histórico de módulos, em pt-BR. Quando a mudança veio por dependência,
 * diz qual módulo a puxou: "Desligou Burndown (junto com Sprints)".
 */
export function historyActionText(event: ProjectModuleEventDto): string {
  const together = event.auto ? ` (junto com ${event.relatedModuleName ?? 'outro módulo'})` : ''
  switch (event.action) {
    case 'enabled':
      return `Ligou ${event.moduleName}${together}`
    case 'disabled':
      return `Desligou ${event.moduleName}${together}`
    case 'winding_down':
      return `Pôs ${event.moduleName} em encerramento${together}`
    case 'scheduled_disable':
      // Nada é agendado de fato: o pedido é recusado e nenhum módulo muda.
      return `Pediu para desligar ${event.moduleName} com a sprint ativa (nada foi desligado)${together}`
    case 'cancelled':
      return `Cancelou o desligamento agendado de ${event.moduleName}`
  }
}

/** Data e hora curtas em pt-BR para a linha do tempo dos módulos. */
export function historyDateText(at: string): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return at
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
