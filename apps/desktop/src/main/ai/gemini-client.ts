import {
  aiProposedActionSchema,
  type AiCompleteInput,
  type AiCompleteResult,
  type AiContextSnapshot,
  type AiModel,
  type AiProposedAction,
  type AiTestResult,
} from '@agilebox/contract'

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_TIMEOUT_MS = 20_000

export interface GeminiClient {
  testConnection(apiKey: string, model: AiModel): Promise<AiTestResult>
  complete(apiKey: string, model: AiModel, input: AiCompleteInput): Promise<AiCompleteResult>
}

export interface CreateGeminiClientOptions {
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}

function endpointFor(model: AiModel): string {
  return `${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent`
}

function mapHttpErrorMessage(status: number): string {
  if (status === 401 || status === 403) return 'Chave da API inválida ou sem permissão.'
  if (status === 429) return 'Limite temporário da API atingido. Tente novamente em instantes.'
  if (status === 404) return 'Modelo Gemini indisponível para esta chave.'
  return `Erro na comunicação com o Gemini (HTTP ${status}).`
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  return match?.[1] ? match[1].trim() : trimmed
}

function extractGeminiText(envelope: unknown): string | null {
  if (typeof envelope !== 'object' || envelope === null) return null
  const candidates = (envelope as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const first: unknown = (candidates as unknown[])[0]
  if (typeof first !== 'object' || first === null) return null
  const content = (first as { content?: unknown }).content
  if (typeof content !== 'object' || content === null) return null
  const parts = (content as { parts?: unknown }).parts
  if (!Array.isArray(parts)) return null
  const texts: string[] = []
  for (const part of parts) {
    if (typeof part === 'object' && part !== null) {
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') texts.push(text)
    }
  }
  const joined = texts.join('').trim()
  return joined.length > 0 ? joined : null
}

function parseModelPayload(raw: unknown): { reply: string; actions: unknown[] } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.reply !== 'string') return null
  const reply = obj.reply.trim()
  if (reply.length === 0) return null
  if (obj.actions !== undefined && !Array.isArray(obj.actions)) return null
  return { reply, actions: Array.isArray(obj.actions) ? obj.actions : [] }
}

function isActionAllowed(
  action: AiProposedAction,
  capabilities: AiContextSnapshot['capabilities'],
): boolean {
  if (
    !capabilities.impediments &&
    (action.kind === 'block_task' || action.kind === 'unblock_task')
  ) {
    return false
  }
  if (!capabilities.checkins && action.kind === 'record_daily') {
    return false
  }
  return true
}

function buildSystemInstruction(context: AiContextSnapshot): string {
  const projectsSummary =
    context.projects.map((p) => `- ${p.name} (id: ${p.id})`).join('\n') || '- Nenhum'
  const usersSummary =
    context.users.map((u) => `- ${u.name} (id: ${u.id})`).join('\n') || '- Nenhum'
  const tasksSummary =
    context.tasks
      .slice(0, 40)
      .map(
        (t) =>
          `- ${t.key} (id: ${t.id}) | ${t.status} | ${t.projectName}${t.blocked ? ' | BLOQUEADA' : ''}: ${t.title}`,
      )
      .join('\n') || '- Nenhuma tarefa listada'

  const allowedKinds = [
    'create_task: { kind: "create_task", title, projectId?, status?, responsibleId?, deadline? ("YYYY-MM-DD"|null) }',
    'move_task: { kind: "move_task", taskKey? | taskId?, status }',
    'log_hours: { kind: "log_hours", taskKey? | taskId?, hours (número positivo a somar) }',
    ...(context.capabilities.impediments
      ? [
          'block_task: { kind: "block_task", taskKey? | taskId?, reason }',
          'unblock_task: { kind: "unblock_task", taskKey? | taskId?, resolution? }',
        ]
      : []),
    'add_comment: { kind: "add_comment", taskKey? | taskId?, body }',
    ...(context.capabilities.checkins
      ? ['record_daily: { kind: "record_daily", progress, nextStep?, blocker? }']
      : []),
  ]

  return [
    'Você é o Kan, assistente enxuto e prático do aplicativo desktop AgileBox.',
    'Responda sempre em português do Brasil, de forma curta e objetiva.',
    `Usuário atual: ${context.actorName} (${context.actorRole === 'manager' ? 'Gestor' : 'Colaborador'}).`,
    'Estados oficiais permitidos para status:',
    '- "planning" (Planejamento)',
    '- "todo" (A fazer)',
    '- "in_progress" (Desenvolvendo)',
    '- "review" (Revisar)',
    '- "done" (Concluído)',
    '',
    'Projetos disponíveis:',
    projectsSummary,
    '',
    'Pessoas disponíveis:',
    usersSummary,
    '',
    'Tarefas atuais no contexto:',
    tasksSummary,
    '',
    'Ações permitidas no JSON de resposta:',
    ...allowedKinds.map((line) => `- ${line}`),
    '',
    'Regras:',
    '- Retorne ESTRITAMENTE um JSON válido no formato: { "reply": string, "actions": [...] }.',
    '- Só inclua ações em "actions" quando o usuário pedir para criar, mover, comentar ou atualizar algo.',
    '- Para perguntas/consultas (ex.: listar foco), retorne "actions": [] e responda em "reply".',
    !context.capabilities.checkins
      ? '- Check-ins/Daily estão desligados neste projeto: nunca mencione daily.'
      : '',
    !context.capabilities.impediments
      ? '- Impedimentos estão desligados neste projeto: nunca sugira bloquear ou desbloquear.'
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function createGeminiClient({
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CreateGeminiClientOptions = {}): GeminiClient {
  return {
    async testConnection(apiKey, model) {
      try {
        const response = await fetchImpl(endpointFor(model), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Responda apenas OK.' }] }],
            generationConfig: { maxOutputTokens: 8, temperature: 0 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) {
          return { ok: false, message: mapHttpErrorMessage(response.status) }
        }
        return { ok: true, model }
      } catch {
        return { ok: false, message: 'Não foi possível alcançar a API do Gemini.' }
      }
    },

    async complete(apiKey, model, input) {
      const contents = [
        ...input.history.slice(-10).map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        })),
        { role: 'user', parts: [{ text: input.prompt }] },
      ]

      let response: Response
      try {
        response = await fetchImpl(endpointFor(model), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: buildSystemInstruction(input.context) }] },
            contents,
            generationConfig: {
              temperature: 0.25,
              responseMimeType: 'application/json',
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        return {
          ok: false,
          reason: 'network',
          message: 'Sem conexão com a API do Gemini no momento.',
        }
      }

      if (!response.ok) {
        return {
          ok: false,
          reason: 'api_error',
          message: mapHttpErrorMessage(response.status),
        }
      }

      try {
        const rawEnvelope: unknown = await response.json()
        const text = extractGeminiText(rawEnvelope)
        if (!text) {
          return {
            ok: false,
            reason: 'invalid_response',
            message: 'O modelo retornou uma resposta vazia.',
          }
        }
        const rawModelJson: unknown = JSON.parse(stripJsonFence(text))
        const payload = parseModelPayload(rawModelJson)
        if (!payload) {
          return {
            ok: false,
            reason: 'invalid_response',
            message: 'A resposta do modelo veio em um formato inesperado.',
          }
        }
        const validActions: AiProposedAction[] = []
        for (const item of payload.actions) {
          const parsedAction = aiProposedActionSchema.safeParse(item)
          if (
            parsedAction.success &&
            isActionAllowed(parsedAction.data, input.context.capabilities)
          ) {
            validActions.push(parsedAction.data)
          }
        }
        return {
          ok: true,
          reply: payload.reply,
          actions: validActions,
        }
      } catch {
        return {
          ok: false,
          reason: 'invalid_response',
          message: 'A resposta do modelo veio em um formato inesperado.',
        }
      }
    },
  }
}
