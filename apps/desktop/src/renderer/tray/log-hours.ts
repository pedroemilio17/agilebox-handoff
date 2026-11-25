import type { AgileBoxApi } from '@agilebox/contract'

/**
 * Soma horas à participação da pessoa na tarefa (cria como Apoio se ela ainda não participa).
 * Mesmo caminho do Kan ("Lançar 1h em AB-5"): application + linha do tempo, sem atalho.
 */
export async function logActorHours(
  api: AgileBoxApi,
  input: { readonly taskId: string; readonly userId: string; readonly hours: number },
): Promise<void> {
  if (input.hours <= 0) return
  const detail = await api.tasks.get({ taskId: input.taskId })
  let participation = detail.participations.find(
    (item) => item.participant.kind === 'user' && item.participant.userId === input.userId,
  )
  if (!participation) {
    participation = await api.participations.add({
      taskId: detail.id,
      participant: { kind: 'user', userId: input.userId },
      role: 'support',
    })
  }
  const next = Math.round((participation.hours + input.hours) * 100) / 100
  await api.participations.setHours({
    taskId: detail.id,
    participationId: participation.id,
    hours: String(next),
  })
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1).replace('.', ',')} h`
}
