import type { ScheduleDependencyDto, ScheduleTaskDto, ScheduleViewDto } from '@agilebox/contract'
import { wbsId } from '../wbs/wbs-fixtures'

export const SCHEDULE_PROJECT = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

/** Id de tarefa de teste no formato ULID (26 caracteres). */
export function taskId(suffix: string): string {
  return `01J8Y4G2XK8Z1S6M3Q9T${suffix.padStart(5, '0')}`
}

export function scheduleTask(
  overrides: Partial<ScheduleTaskDto> & { readonly taskId: string },
): ScheduleTaskDto {
  return {
    key: 'ERP-1',
    title: 'Cadastro de produtos',
    status: 'in_progress',
    deliverableId: null,
    deliverableCode: null,
    startsOn: '2026-11-02',
    deadline: '2026-11-14',
    responsibleName: 'Ana Souza',
    done: false,
    progress: 0,
    canEdit: true,
    ...overrides,
  }
}

export function dependency(
  predecessorId: string,
  successorId: string,
  conflict = false,
): ScheduleDependencyDto {
  return { predecessorId, successorId, conflict }
}

/** Cronograma completo para os testes; sobrescreva o que o caso precisa. */
export function scheduleView(overrides: Partial<ScheduleViewDto> = {}): ScheduleViewDto {
  const tasks = overrides.tasks ?? []
  return {
    projectId: SCHEDULE_PROJECT,
    canEdit: true,
    range: { start: '2026-11-02', end: '2027-01-30' },
    tasks: [...tasks],
    dependencies: [],
    milestones: [],
    today: '2026-11-16',
    ...overrides,
  }
}

export const DELIVERABLE_A = wbsId('A1')
export const DELIVERABLE_B = wbsId('B2')
