import { describe, expect, it } from 'vitest'
import {
  createAcceptanceCriterion,
  toAcceptanceCriterionId,
  toOrganizationId,
} from '@agilebox/core'
import type { AcceptanceCriterion, Task } from '@agilebox/core'
import type { AcceptanceRepository, TaskRepository } from '../ports'

export interface AcceptanceContractAdapters {
  readonly acceptance: AcceptanceRepository
  readonly tasks: TaskRepository
  /** Tarefa já gravada na organização A (com o responsável gravado). */
  readonly taskA: Task
  /** Tarefa já gravada na organização B. */
  readonly taskB: Task
}

export const acceptanceFixtures = {
  organizationA: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
  organizationB: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW'),
}

const timestamp = '2026-01-01T00:00:00.000Z'

function criterionOf(
  task: Task,
  id: string,
  position: number,
  overrides: Partial<Pick<AcceptanceCriterion, 'text' | 'done'>> = {},
): AcceptanceCriterion {
  return createAcceptanceCriterion({
    id: toAcceptanceCriterionId(id),
    organizationId: task.organizationId,
    taskId: task.id,
    text: overrides.text ?? `Critério ${position + 1}`,
    done: overrides.done ?? false,
    position,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

/**
 * Suíte de contrato do repositório de critérios de aceitação (M3.2). Roda no fake e no SQLite: trocar
 * o adaptador não pode mudar o comportamento. Inclui isolamento entre organizações e a gravação da
 * estimativa, que mora na tabela de tarefas.
 */
export function describeAcceptanceRepositoryContract(
  name: string,
  makeAdapters: () => Promise<AcceptanceContractAdapters>,
): void {
  describe(`contrato do repositório de critérios: ${name}`, () => {
    it('lista os critérios da tarefa em ordem de posição', async () => {
      const { acceptance, taskA } = await makeAdapters()
      await acceptance.saveMany(acceptanceFixtures.organizationA, [
        criterionOf(taskA, '01ARZ3NDEKTSV4RRFFQ69G5FC1', 1),
        criterionOf(taskA, '01ARZ3NDEKTSV4RRFFQ69G5FC0', 0),
      ])
      const listed = await acceptance.listByTask(acceptanceFixtures.organizationA, taskA.id)
      expect(listed.map((criterion) => [criterion.position, criterion.text])).toEqual([
        [0, 'Critério 1'],
        [1, 'Critério 2'],
      ])
    })

    it('grava, altera e remove critérios por identificador', async () => {
      const { acceptance, taskA } = await makeAdapters()
      const org = acceptanceFixtures.organizationA
      await acceptance.saveMany(org, [criterionOf(taskA, '01ARZ3NDEKTSV4RRFFQ69G5FC0', 0)])
      await acceptance.saveMany(org, [
        criterionOf(taskA, '01ARZ3NDEKTSV4RRFFQ69G5FC0', 0, { text: 'Trocado', done: true }),
      ])
      expect(await acceptance.listByTask(org, taskA.id)).toEqual([
        expect.objectContaining({ text: 'Trocado', done: true }),
      ])
      await acceptance.remove(org, toAcceptanceCriterionId('01ARZ3NDEKTSV4RRFFQ69G5FC0'))
      expect(await acceptance.listByTask(org, taskA.id)).toEqual([])
    })

    it('não grava critério de tarefa de outra organização', async () => {
      const { acceptance, taskB } = await makeAdapters()
      await acceptance.saveMany(acceptanceFixtures.organizationA, [
        criterionOf(taskB, '01ARZ3NDEKTSV4RRFFQ69G5FC2', 0),
      ])
      expect(await acceptance.listByTask(acceptanceFixtures.organizationA, taskB.id)).toEqual([])
      expect(await acceptance.listByTask(acceptanceFixtures.organizationB, taskB.id)).toEqual([])
    })

    it('isola leituras entre organizações', async () => {
      const { acceptance, taskA } = await makeAdapters()
      await acceptance.saveMany(acceptanceFixtures.organizationA, [
        criterionOf(taskA, '01ARZ3NDEKTSV4RRFFQ69G5FC3', 0),
      ])
      expect(await acceptance.listByTask(acceptanceFixtures.organizationB, taskA.id)).toEqual([])
    })

    it('grava a estimativa em horas junto com a tarefa e a devolve', async () => {
      const { tasks, taskA } = await makeAdapters()
      const org = acceptanceFixtures.organizationA
      await tasks.save(org, { ...taskA, estimatedHoursHundredths: 250 })
      expect((await tasks.findById(org, taskA.id))?.estimatedHoursHundredths).toBe(250)
      await tasks.save(org, { ...taskA, estimatedHoursHundredths: null })
      expect((await tasks.findById(org, taskA.id))?.estimatedHoursHundredths).toBeNull()
    })
  })
}
