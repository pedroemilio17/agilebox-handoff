import { describe, expect, it } from 'vitest'
import { parseDateOnly } from '@agilebox/core'
import type { AiContextSnapshot } from '@agilebox/contract'
import { forbiddenTermsIn } from '../../shared/testing/forbidden-terms'
import { parseLocalKanPrompt } from './kan-local-parser'

const TODAY = parseDateOnly('2026-11-23')

const CONTEXT: AiContextSnapshot = {
  actorName: 'Pedro',
  actorRole: 'collaborator',
  projects: [
    { id: 'proj-a', name: 'Aurora' },
    { id: 'proj-b', name: 'Boreal' },
  ],
  users: [
    { id: 'user-1', name: 'Pedro' },
    { id: 'user-2', name: 'Ana Souza' },
  ],
  tasks: [
    {
      id: 'task-1',
      key: 'AB-5',
      title: 'Ajustar webhook',
      status: 'in_progress',
      projectName: 'Aurora',
      blocked: false,
    },
    {
      id: 'task-2',
      key: 'AB-8',
      title: 'Publicar relatório',
      status: 'review',
      projectName: 'Boreal',
      blocked: true,
    },
  ],
  capabilities: { checkins: true, impediments: true },
}

describe('kan-local-parser', () => {
  it('lista tarefas em foco sem gerar mutações', () => {
    const result = parseLocalKanPrompt('Quais são minhas tarefas?', CONTEXT, TODAY)
    expect(result.actions).toEqual([])
    expect(result.reply).toContain('AB-5')
    expect(result.reply).toContain('AB-8')
  })

  it('interpreta criação de tarefa com estado, @pessoa e #projeto', () => {
    const result = parseLocalKanPrompt(
      'Criar tarefa Validar certificado #Boreal @Ana em Planejamento',
      CONTEXT,
      TODAY,
    )
    expect(result.actions).toEqual([
      {
        kind: 'create_task',
        title: 'Validar certificado',
        projectId: 'proj-b',
        status: 'planning',
        responsibleId: 'user-2',
      },
    ])
  })

  it('interpreta movimentação para Concluído e lançamento de horas', () => {
    expect(parseLocalKanPrompt('Mover AB-5 para concluído', CONTEXT, TODAY).actions).toEqual([
      {
        kind: 'move_task',
        taskId: 'task-1',
        taskKey: 'AB-5',
        status: 'done',
      },
    ])

    expect(parseLocalKanPrompt('+1,5h em AB-5', CONTEXT, TODAY).actions).toEqual([
      {
        kind: 'log_hours',
        taskId: 'task-1',
        taskKey: 'AB-5',
        hours: 1.5,
      },
    ])
  })

  it('no modo básico sem check-ins nem impedimentos não expõe termos proibidos', () => {
    const basicContext: AiContextSnapshot = {
      ...CONTEXT,
      capabilities: { checkins: false, impediments: false },
    }
    const fallback = parseLocalKanPrompt('oi tudo bem?', basicContext, TODAY)
    expect(forbiddenTermsIn(fallback.reply)).toEqual([])
    expect(parseLocalKanPrompt('registrar daily: ok', basicContext, TODAY).actions).toEqual([])
    expect(parseLocalKanPrompt('bloquear AB-5 por erro', basicContext, TODAY).actions).toEqual([])
  })
})
