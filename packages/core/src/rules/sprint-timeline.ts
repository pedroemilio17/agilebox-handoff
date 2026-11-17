import type { SprintEvent } from '../entities/sprint-event'
import { sprintLabel } from '../entities/sprint'

/** Texto pt-BR de um evento da sprint, para a atividade e para a linha do tempo da equipe. */
export function describeSprintEvent(event: SprintEvent): string {
  switch (event.type) {
    case 'sprint_started':
      return `iniciou a ${sprintLabel(event.sprintNumber)}`
    case 'sprint_closed': {
      const destination =
        event.payload.closePolicy === 'carry_over'
          ? 'levou os itens abertos para a sprint seguinte'
          : 'devolveu os itens abertos ao backlog'
      return `encerrou a ${sprintLabel(event.sprintNumber)} e ${destination}`
    }
  }
}
