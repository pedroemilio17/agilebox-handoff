import { ValidationError } from '../shared/errors'
import type { BaselineId, OrganizationId, ProjectId, TaskId, UserId } from '../shared/ids'
import type { DateOnly } from '../values/date-only'

/** Nome da linha de base: texto curto, obrigatório. */
export const BASELINE_NAME_MAX_LENGTH = 80

/**
 * Plano de uma tarefa numa data (ADR-10, módulo `baseline`). É a linha da foto e também a leitura do
 * plano atual da tarefa, na mesma forma, para a comparação sair de uma regra só. Início e fim são
 * nulos quando a tarefa não tinha. Horas em centésimos e custo em centavos (PLANO 3.7).
 */
export interface BaselineTask {
  readonly taskId: TaskId
  readonly title: string
  readonly startsOn: DateOnly | null
  /** Fim da tarefa, que é o prazo (`deadline`). */
  readonly endsOn: DateOnly | null
  readonly estimatedHoursHundredths: number | null
  /**
   * Custo estimado (horas × valor/hora do Responsável). Nulo sem estimativa, sem Responsável ou sem
   * valor, e sempre nulo quando o módulo `cost` estava desligado na foto.
   */
  readonly plannedCostCents: number | null
}

/** Foto do cronograma e do custo do projeto numa data. Guarda as tarefas com datas, junto da foto. */
export interface Baseline {
  readonly id: BaselineId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly name: string
  readonly takenAt: string
  readonly takenBy: UserId
  readonly tasks: readonly BaselineTask[]
}

/** Nome da linha de base sem espaços nas pontas. Vazio ou longo demais não vale. */
export function normalizeBaselineName(value: string): string {
  const name = value.trim()
  if (name.length === 0) throw new ValidationError('Nome da linha de base vazio')
  if (name.length > BASELINE_NAME_MAX_LENGTH)
    throw new ValidationError('Nome da linha de base longo demais')
  return name
}
