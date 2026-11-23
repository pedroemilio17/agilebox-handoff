import { z } from 'zod'
import { userRoleSchema } from './shared-schemas'
import { taskStatusSchema } from './tasks'

/** Canais IPC dedicados ao assistente Kan (apenas no app desktop). */
export const AI_CHANNELS = {
  getConfig: 'ai.getConfig',
  saveConfig: 'ai.saveConfig',
  clearKey: 'ai.clearKey',
  testConnection: 'ai.testConnection',
  complete: 'ai.complete',
} as const

export const AI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'] as const
export type AiModel = (typeof AI_MODELS)[number]
export const DEFAULT_AI_MODEL: AiModel = 'gemini-2.5-flash'

export const aiModelSchema = z.enum(AI_MODELS)

export const aiConfigStatusSchema = z.object({
  configured: z.boolean(),
  model: aiModelSchema,
  encrypted: z.boolean(),
})
export type AiConfigStatus = z.infer<typeof aiConfigStatusSchema>

export const saveAiConfigInputSchema = z.object({
  apiKey: z.string().optional(),
  model: aiModelSchema,
})
export type SaveAiConfigInput = z.infer<typeof saveAiConfigInputSchema>

export const aiTestResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), model: aiModelSchema }),
  z.object({ ok: z.literal(false), message: z.string().min(1) }),
])
export type AiTestResult = z.infer<typeof aiTestResultSchema>

export const aiChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1),
})
export type AiChatTurn = z.infer<typeof aiChatTurnSchema>

export const aiContextTaskSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  title: z.string().min(1),
  status: taskStatusSchema,
  projectName: z.string().min(1),
  blocked: z.boolean(),
})

export const aiContextSnapshotSchema = z.object({
  actorName: z.string().min(1),
  actorRole: userRoleSchema,
  projects: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  users: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  tasks: z.array(aiContextTaskSchema),
  capabilities: z.object({
    checkins: z.boolean(),
    impediments: z.boolean(),
  }),
})
export type AiContextSnapshot = z.infer<typeof aiContextSnapshotSchema>

export const aiProposedActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('create_task'),
    title: z.string().trim().min(1),
    projectId: z.string().min(1).optional(),
    status: taskStatusSchema.optional(),
    responsibleId: z.string().min(1).optional(),
    deadline: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('move_task'),
    taskId: z.string().min(1).optional(),
    taskKey: z.string().min(1).optional(),
    status: taskStatusSchema,
  }),
  z.object({
    kind: z.literal('log_hours'),
    taskId: z.string().min(1).optional(),
    taskKey: z.string().min(1).optional(),
    hours: z.number().finite().positive().max(999),
  }),
  z.object({
    kind: z.literal('block_task'),
    taskId: z.string().min(1).optional(),
    taskKey: z.string().min(1).optional(),
    reason: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal('unblock_task'),
    taskId: z.string().min(1).optional(),
    taskKey: z.string().min(1).optional(),
    resolution: z.string().trim().min(1).optional(),
  }),
  z.object({
    kind: z.literal('add_comment'),
    taskId: z.string().min(1).optional(),
    taskKey: z.string().min(1).optional(),
    body: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal('record_daily'),
    progress: z.string().trim().min(1),
    nextStep: z.string().trim().optional(),
    blocker: z.string().trim().optional(),
  }),
])
export type AiProposedAction = z.infer<typeof aiProposedActionSchema>

export const aiCompleteInputSchema = z.object({
  prompt: z.string().trim().min(1),
  history: z.array(aiChatTurnSchema).max(16),
  context: aiContextSnapshotSchema,
})
export type AiCompleteInput = z.infer<typeof aiCompleteInputSchema>

export const aiFailureReasonSchema = z.enum([
  'not_configured',
  'network',
  'api_error',
  'invalid_response',
])
export type AiFailureReason = z.infer<typeof aiFailureReasonSchema>

export const aiCompleteResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    reply: z.string(),
    actions: z.array(aiProposedActionSchema),
  }),
  z.object({
    ok: z.literal(false),
    reason: aiFailureReasonSchema,
    message: z.string().min(1),
  }),
])
export type AiCompleteResult = z.infer<typeof aiCompleteResultSchema>

export interface DesktopAiApi {
  getConfig(): Promise<AiConfigStatus>
  saveConfig(input: SaveAiConfigInput): Promise<AiConfigStatus>
  clearKey(): Promise<AiConfigStatus>
  testConnection(): Promise<AiTestResult>
  complete(input: AiCompleteInput): Promise<AiCompleteResult>
}
