import { z } from 'zod'
import { ulidSchema } from './shared-schemas'
import { taskDtoSchema, taskStatusSchema } from './tasks'

/** Data `YYYY-MM-DD` (início e prazo). O domínio valida o calendário e a ordem (início não depois do prazo). */
const dateSchema = z.iso.date()

/** Tarefa no cronograma. `deliverableCode` só vem com o módulo `wbs` ligado no projeto; `progress` é 100 quando concluída. */
export const scheduleTaskDtoSchema = z.object({
  taskId: ulidSchema,
  key: z.string().min(1),
  title: z.string().min(1),
  status: taskStatusSchema,
  deliverableId: ulidSchema.nullable(),
  deliverableCode: z.string().nullable(),
  startsOn: dateSchema.nullable(),
  deadline: dateSchema.nullable(),
  responsibleName: z.string().nullable(),
  done: z.boolean(),
  progress: z.union([z.literal(0), z.literal(100)]),
  canEdit: z.boolean(),
})

/** Dependência término→início entre duas tarefas do cronograma. `conflict`: o término da predecessora passa do início da sucessora. */
export const scheduleDependencyDtoSchema = z.object({
  predecessorId: ulidSchema,
  successorId: ulidSchema,
  conflict: z.boolean(),
})

/** Marco no cronograma. Vem só com o módulo `milestones` ligado no projeto. */
export const scheduleMilestoneDtoSchema = z.object({
  id: ulidSchema,
  title: z.string().min(1),
  dueOn: dateSchema,
})

export const scheduleViewDtoSchema = z.object({
  projectId: ulidSchema,
  /** Quem pode planejar: gestor ou criador do projeto, com o projeto ativo. */
  canEdit: z.boolean(),
  /** Menor início e maior prazo entre as tarefas com as duas datas. Nulo quando não há nenhuma. */
  range: z.object({ start: dateSchema, end: dateSchema }).nullable(),
  tasks: z.array(scheduleTaskDtoSchema),
  dependencies: z.array(scheduleDependencyDtoSchema),
  milestones: z.array(scheduleMilestoneDtoSchema),
  today: dateSchema,
})

export const getScheduleInputSchema = z.object({ projectId: ulidSchema })
export const getScheduleOutputSchema = scheduleViewDtoSchema

/** Dependência término→início: a sucessora passa a depender da predecessora. Quem edita a sucessora faz isso. */
export const dependencyInputSchema = z.object({
  predecessorId: ulidSchema,
  successorId: ulidSchema,
})
export const addTaskDependencyInputSchema = dependencyInputSchema
export const addTaskDependencyOutputSchema = scheduleViewDtoSchema
export const removeTaskDependencyInputSchema = dependencyInputSchema
export const removeTaskDependencyOutputSchema = scheduleViewDtoSchema

/** Início da tarefa (nulo remove). Quem edita a tarefa define o início. */
export const setTaskStartInputSchema = z.object({
  taskId: ulidSchema,
  startsOn: dateSchema.nullable(),
})
export const setTaskStartOutputSchema = taskDtoSchema

export type ScheduleTaskDto = z.infer<typeof scheduleTaskDtoSchema>
export type ScheduleDependencyDto = z.infer<typeof scheduleDependencyDtoSchema>
export type ScheduleMilestoneDto = z.infer<typeof scheduleMilestoneDtoSchema>
export type ScheduleViewDto = z.infer<typeof scheduleViewDtoSchema>
export type SetTaskStartInput = z.infer<typeof setTaskStartInputSchema>
