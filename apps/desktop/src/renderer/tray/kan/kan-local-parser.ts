import {
  TASK_STATUS_LABELS,
  parseQuickAdd,
  type DateOnly,
  type QuickAddPerson,
  type TaskStatus,
} from '@agilebox/core'
import type { AiContextSnapshot, AiProposedAction } from '@agilebox/contract'

export interface LocalKanResult {
  readonly reply: string
  readonly actions: readonly AiProposedAction[]
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim()
}

export function parseStatusFromText(raw: string): TaskStatus | null {
  const n = normalize(raw)
  if (!n) return null
  if (/\b(planej\w*|triage)\b/u.test(n)) return 'planning'
  if (/\b(a\s+fazer|afazer)\b/u.test(n)) return 'todo'
  if (/\b(desenvolv\w*|em\s+andamento)\b/u.test(n)) return 'in_progress'
  if (/\b(revis\w*)\b/u.test(n)) return 'review'
  if (/\b(conclu\w*|finaliz\w*|fechad\w*)\b/u.test(n)) return 'done'
  return null
}

function extractTaskKey(raw: string): string | null {
  const match = /\b([A-Za-z]{2,5}-[1-9]\d*)\b/u.exec(raw)
  return match?.[1] ? match[1].toUpperCase() : null
}

function resolveTaskMatch(raw: string, context: AiContextSnapshot) {
  const explicitKey = extractTaskKey(raw)
  if (explicitKey) {
    const found = context.tasks.find((t) => t.key.toUpperCase() === explicitKey)
    return { task: found ?? null, explicitKey }
  }
  const n = normalize(raw)
  const byTitle = context.tasks.find((t) => {
    const nt = normalize(t.title)
    return nt.length >= 4 && n.includes(nt)
  })
  return { task: byTitle ?? null, explicitKey: null }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean)
  if (parts.length === 0) return 'AB'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

function stripStatusPhrase(raw: string): string {
  return raw
    .replace(
      /\b(?:em|para(?:\s+o\s+estado)?|na\s+coluna|como)\s+(?:planejamento|a\s+fazer|desenvolvendo|revisar|revis[aã]o|conclu[ií]d[ao])\b/giu,
      '',
    )
    .replace(/\s{2,}/gu, ' ')
    .trim()
}

function stripCreatePrefix(raw: string): string {
  return raw
    .replace(
      /^(?:por\s+favor,?\s*)?(?:criar|cria|nova|adicionar|adiciona)\s+(?:uma\s+)?tarefa\s*[:-]?\s*/iu,
      '',
    )
    .trim()
}

export function parseLocalKanPrompt(
  prompt: string,
  context: AiContextSnapshot,
  today: DateOnly,
): LocalKanResult {
  const text = prompt.trim()
  const norm = normalize(text)
  const { task: matchedTask, explicitKey } = resolveTaskMatch(text, context)

  // 1. Consultas / resumo em foco
  if (
    /^(?:quais|mostr\w*|list\w*|resum\w*|status|minhas\s+tarefas|em\s+foco|o\s+que\s+tenho|tarefas\b)/u.test(
      norm,
    ) ||
    (/\b(?:em\s+foco|minhas\s+tarefas|bloquead\w*)\b/u.test(norm) &&
      !/\b(?:criar|cria|nova|mover|mudar|passar|bloquear|desbloquear|lancar|comentar|registrar)\b/u.test(
        norm,
      ))
  ) {
    const wantsBlocked = context.capabilities.impediments && /bloquead/u.test(norm)
    const list = wantsBlocked
      ? context.tasks.filter((t) => t.blocked && t.status !== 'done')
      : context.tasks.filter((t) => t.status !== 'done')

    if (list.length === 0) {
      return {
        reply: wantsBlocked
          ? 'Nenhuma tarefa com impedimento aberta agora.'
          : 'Você não tem tarefas abertas em foco agora.',
        actions: [],
      }
    }

    const lines = list
      .slice(0, 6)
      .map((t) => `• ${t.key} (${TASK_STATUS_LABELS[t.status]}) — ${t.title}`)
      .join('\n')
    const suffix = list.length > 6 ? `\n… e mais ${list.length - 6}.` : ''
    return {
      reply: `Encontrei ${list.length} ${list.length === 1 ? 'tarefa' : 'tarefas'}:\n${lines}${suffix}`,
      actions: [],
    }
  }

  // 2. Registrar atualização do dia (check-ins)
  if (
    context.capabilities.checkins &&
    /\b(?:daily|atualizacao\s+do\s+dia|check-?in|fiz\s+hoje|trabalhei\s+em)\b/u.test(norm)
  ) {
    const progress = text
      .replace(
        /^(?:registrar\s+)?(?:a\s+)?(?:daily|atualiza[cç][aã]o\s+do\s+dia|check-?in)\s*[:-]?\s*/iu,
        '',
      )
      .trim()
    return {
      reply: 'Registrando sua atualização do dia.',
      actions: [
        {
          kind: 'record_daily',
          progress: progress || 'Atualização do dia registrada via Kan.',
        },
      ],
    }
  }

  // 3. Criar tarefa
  if (
    /^(?:por\s+favor,?\s*)?(?:criar|cria|nova|adicionar|adiciona)\s+(?:uma\s+)?tarefa\b/u.test(
      norm,
    ) ||
    /\bcriar\s+tarefa\b/u.test(norm)
  ) {
    const requestedStatus = parseStatusFromText(text) ?? 'todo'
    const draftWithoutPrefix = stripStatusPhrase(stripCreatePrefix(text))
    const people: QuickAddPerson[] = context.users.map((user) => ({
      id: user.id,
      name: user.name,
      initials: initialsOf(user.name),
    }))
    const parsed = parseQuickAdd(draftWithoutPrefix, {
      today,
      projects: context.projects,
      people,
    })

    let title = parsed.title.trim()
    let responsibleId = parsed.responsibleId ?? undefined
    if (!responsibleId) {
      const paraMatch = /\bpara\s+([A-Za-zÀ-ÿ]+)\s*$/iu.exec(title)
      if (paraMatch?.[1]) {
        const personNorm = normalize(paraMatch[1])
        const userFound = context.users.find((user) => normalize(user.name).includes(personNorm))
        if (userFound) {
          responsibleId = userFound.id
          title = title.slice(0, paraMatch.index).trim()
        }
      }
    }

    const projectId = parsed.projectId ?? context.projects[0]?.id
    return {
      reply: 'Criando a tarefa solicitada.',
      actions: [
        {
          kind: 'create_task',
          title: title || 'Nova tarefa',
          ...(projectId ? { projectId } : {}),
          status: requestedStatus,
          ...(responsibleId ? { responsibleId } : {}),
          ...(parsed.deadline ? { deadline: parsed.deadline } : {}),
        },
      ],
    }
  }

  // 4. Bloquear / Desbloquear (apenas se impedimentos ativos)
  if (
    context.capabilities.impediments &&
    /\b(?:desbloquear|tirar\s+bloqueio|resolver\s+bloqueio)\b/u.test(norm)
  ) {
    const target = matchedTask ?? (explicitKey ? { id: undefined, key: explicitKey } : null)
    if (!target) {
      return {
        reply: 'Informe a chave da tarefa para desbloquear (ex.: desbloquear AB-5).',
        actions: [],
      }
    }
    return {
      reply: `Removendo bloqueio de ${target.key}.`,
      actions: [
        {
          kind: 'unblock_task',
          ...(target.id ? { taskId: target.id } : {}),
          taskKey: target.key,
        },
      ],
    }
  }

  if (context.capabilities.impediments && /\b(?:bloquear|travar)\b/u.test(norm)) {
    const target = matchedTask ?? (explicitKey ? { id: undefined, key: explicitKey } : null)
    if (!target) {
      return {
        reply: 'Informe a chave da tarefa para bloquear (ex.: bloquear AB-5 por falta de acesso).',
        actions: [],
      }
    }
    const reasonMatch = /\b(?:por|motivo|porque)\s+(.+)$/iu.exec(text)
    const reason = reasonMatch?.[1]?.trim() || 'Bloqueio registrado pelo Kan.'
    return {
      reply: `Registrando impedimento em ${target.key}.`,
      actions: [
        {
          kind: 'block_task',
          ...(target.id ? { taskId: target.id } : {}),
          taskKey: target.key,
          reason,
        },
      ],
    }
  }

  // 5. Comentar
  if (/^(?:comentar|comentario)\b/u.test(norm) || /\bcomentar\s+em\b/u.test(norm)) {
    const target = matchedTask ?? (explicitKey ? { id: undefined, key: explicitKey } : null)
    const bodyMatch = /(?:[:-]\s*|em\s+[A-Za-z]{2,5}-[1-9]\d*\s+)(.+)$/iu.exec(text)
    const body = bodyMatch?.[1]?.trim() ?? ''
    if (!target || !body) {
      return {
        reply: 'Informe a tarefa e o comentário (ex.: comentar em AB-5: validado em homologação).',
        actions: [],
      }
    }
    return {
      reply: `Adicionando comentário em ${target.key}.`,
      actions: [
        {
          kind: 'add_comment',
          ...(target.id ? { taskId: target.id } : {}),
          taskKey: target.key,
          body,
        },
      ],
    }
  }

  // 6. Lançar horas
  const hoursMatch = /([+]?\d+(?:[.,]\d+)?)\s*h\b/iu.exec(text)
  if (
    hoursMatch?.[1] &&
    (/\b(?:hora\w*|lancar|somar|registrar|adicionar)\b/u.test(norm) || /^\+?\d/u.test(norm))
  ) {
    const hours = Number.parseFloat(hoursMatch[1].replace(',', '.').replace('+', ''))
    if (Number.isFinite(hours) && hours > 0) {
      const target =
        matchedTask ??
        (explicitKey ? { id: undefined, key: explicitKey } : null) ??
        (context.tasks.length === 1 ? context.tasks[0]! : null)
      if (!target) {
        return {
          reply: 'Informe a chave da tarefa para lançar horas (ex.: +1,5h em AB-5).',
          actions: [],
        }
      }
      return {
        reply: `Lançando ${hours} h em ${target.key}.`,
        actions: [
          {
            kind: 'log_hours',
            ...(target.id ? { taskId: target.id } : {}),
            taskKey: target.key,
            hours,
          },
        ],
      }
    }
  }

  // 7. Mover estado
  const targetStatus = parseStatusFromText(text)
  if (
    targetStatus &&
    (matchedTask ||
      explicitKey ||
      /\b(?:mover|mudar|passar|colocar|concluir)\b/u.test(norm) ||
      /->|→/u.test(text))
  ) {
    const target =
      matchedTask ??
      (explicitKey ? { id: undefined, key: explicitKey } : null) ??
      (context.tasks.length === 1 ? context.tasks[0]! : null)
    if (!target) {
      return {
        reply: `Qual tarefa você quer mover para ${TASK_STATUS_LABELS[targetStatus]}?`,
        actions: [],
      }
    }
    return {
      reply: `Movendo ${target.key} para ${TASK_STATUS_LABELS[targetStatus]}.`,
      actions: [
        {
          kind: 'move_task',
          ...(target.id ? { taskId: target.id } : {}),
          taskKey: target.key,
          status: targetStatus,
        },
      ],
    }
  }

  // 8. Resposta padrão adaptada às ferramentas ativas (sem termos proibidos no Básico)
  const helpParts = [
    'consultar suas tarefas em foco',
    'criar novas tarefas',
    'mudar o estado (Planejamento, A fazer, Desenvolvendo, Revisar, Concluído)',
    'comentar e lançar horas',
  ]
  if (context.capabilities.checkins) helpParts.push('registrar a daily')
  if (context.capabilities.impediments) helpParts.push('registrar ou resolver impedimentos')

  return {
    reply: `Posso ajudar a ${helpParts.join(', ')}. Para conversar livremente, conecte sua chave Gemini em Ajustes.`,
    actions: [],
  }
}
