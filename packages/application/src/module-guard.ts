import {
  ConflictError,
  getModule,
  moduleStateOf,
  moduleUseRefusal,
  PermissionDeniedError,
} from '@agilebox/core'
import type { ModuleId, OrganizationId } from '@agilebox/core'
import type { TeamToolsRepository } from './ports'

/** Módulo de um caso de uso e se ele cria itens novos desse módulo. */
export interface ModuleUsePolicy {
  readonly module: ModuleId
  /** Cria item do módulo: recusado enquanto o módulo está encerrando (`winding_down`). */
  readonly creates?: boolean
}

/**
 * Mapa de módulos dos casos de uso registrados em `createUseCases` (as 64 folhas que passam pela
 * fronteira `forTenant`). Cada caso de uso declara seu módulo; o guard recusa a chamada conforme o
 * estado do módulo na equipe (PLANO-2.0, regra 6).
 *
 * Decisões por caso de uso que não são óbvias:
 * - `dashboard.get` e `dashboard.exportSummary` ficam em `core`: a resposta mistura estatísticas do
 *   núcleo (status, atrasadas, colaboradores) com insights de fluxo. Com `flowMetrics` na regra,
 *   desligar o módulo tiraria o painel inteiro do gestor. Os insights de fluxo do dashboard seguem
 *   acessíveis com o módulo desligado (ver relatório, pendência para o M2).
 * - `daily.save` cria (ou atualiza) a daily do dia: marcado como `creates`, por caso de uso e não
 *   por item. Editar a daily já existente durante o encerramento também é recusado.
 * - `participations.setHours` e `setRate` ficam em `core`: horas e valor/hora alimentam o custo,
 *   que é regra do produto e não da ferramenta de estimativa (`estimates.hours`).
 * - `projects.definitionOfDone.*` fica em `core`: a definição de pronto é do projeto. O módulo
 *   `acceptance` não tem casos de uso próprios hoje.
 * - `teamTools.*` fica em `core`: a gestão das ferramentas não pode ser desligada por ela mesma.
 */
export const USE_CASE_MODULES = {
  'session.listUsers': { module: 'core' },

  'users.setDefaultRate': { module: 'core' },

  'contributors.list': { module: 'core' },
  'contributors.create': { module: 'core' },
  'contributors.setDefaultRate': { module: 'core' },

  'projects.listProjects': { module: 'core' },
  'projects.createProject': { module: 'core' },
  'projects.listMembers': { module: 'core' },
  'projects.addMember': { module: 'core' },
  'projects.removeMember': { module: 'core' },
  'projects.archive': { module: 'core' },
  'projects.unarchive': { module: 'core' },
  'projects.rename': { module: 'core' },
  'projects.definitionOfDone.list': { module: 'core' },
  'projects.definitionOfDone.add': { module: 'core' },
  'projects.definitionOfDone.rename': { module: 'core' },
  'projects.definitionOfDone.remove': { module: 'core' },
  'projects.definitionOfDone.move': { module: 'core' },

  'tasks.create': { module: 'core' },
  'tasks.getDetail': { module: 'core' },
  'tasks.update': { module: 'core' },
  'tasks.move': { module: 'core' },
  'tasks.block': { module: 'impediments', creates: true },
  'tasks.unblock': { module: 'impediments' },
  'tasks.archive': { module: 'core' },
  'tasks.unarchive': { module: 'core' },
  'tasks.checklist.add': { module: 'subtasks', creates: true },
  'tasks.checklist.toggle': { module: 'subtasks' },
  'tasks.checklist.rename': { module: 'subtasks' },
  'tasks.checklist.remove': { module: 'subtasks' },
  'tasks.checklist.move': { module: 'subtasks' },
  'tasks.comments.add': { module: 'core' },
  'tasks.comments.edit': { module: 'core' },
  'tasks.comments.remove': { module: 'core' },
  'tasks.listBoard': { module: 'core' },
  'tasks.getBoardFlow': { module: 'flowMetrics' },
  'tasks.listTeamBoard': { module: 'core' },
  'tasks.listRecent': { module: 'core' },
  'tasks.listFrequent': { module: 'core' },
  'tasks.search': { module: 'core' },
  'tasks.recordOpen': { module: 'core' },

  // Backlog (M3.1): o módulo `backlog` guarda os itens fora do quadro. Encerrando, não aceita item novo.
  'backlog.list': { module: 'backlog' },
  'backlog.add': { module: 'backlog', creates: true },
  'backlog.reorder': { module: 'backlog' },
  'backlog.pull': { module: 'backlog' },
  'backlog.sendBack': { module: 'backlog' },

  'participations.add': { module: 'core' },
  'participations.remove': { module: 'core' },
  'participations.setHours': { module: 'core' },
  'participations.setRate': { module: 'core' },

  'timeline.list': { module: 'core' },

  'dashboard.get': { module: 'core' },
  'dashboard.exportSummary': { module: 'core' },

  'boardSettings.get': { module: 'wip' },
  'boardSettings.setWipLimits': { module: 'wip' },

  'daily.getToday': { module: 'checkins' },
  'daily.save': { module: 'checkins', creates: true },
  'daily.listForDate': { module: 'checkins' },
  'daily.getForUser': { module: 'checkins' },

  'meetings.listRange': { module: 'agenda' },
  'meetings.listUpcoming': { module: 'agenda' },
  'meetings.create': { module: 'agenda', creates: true },
  'meetings.update': { module: 'agenda' },
  'meetings.delete': { module: 'agenda' },
  'meetings.retroActions.list': { module: 'reviewRetro' },
  'meetings.retroActions.add': { module: 'reviewRetro', creates: true },
  'meetings.retroActions.update': { module: 'reviewRetro' },
  'meetings.retroActions.toggle': { module: 'reviewRetro' },
  'meetings.retroActions.remove': { module: 'reviewRetro' },

  // A gestão das ferramentas nunca pode ser desligada: fica no núcleo (PLANO-2.0, regra 6).
  'teamTools.get': { module: 'core' },
  'teamTools.previewChange': { module: 'core' },
  'teamTools.applyChange': { module: 'core' },
  'teamTools.completeWindDown': { module: 'core' },
  'teamTools.setLevel': { module: 'core' },
  'teamTools.applyPreset': { module: 'core' },
} as const satisfies Record<string, ModuleUsePolicy>

/** Caminho de um caso de uso registrado, no formato de `USE_CASE_MODULES` (ex.: `tasks.create`). */
export type UseCasePath = keyof typeof USE_CASE_MODULES

const REFUSAL_ERRORS = {
  module_disabled: () =>
    new PermissionDeniedError('Esta ferramenta está desativada para a equipe.'),
  module_winding_down: () =>
    new ConflictError('Esta ferramenta está sendo encerrada: não aceita itens novos.'),
} as const

/**
 * Recusa a chamada se o módulo do caso de uso não está disponível para a organização. Roda dentro
 * da fronteira `forTenant`, depois de validar o contexto. O núcleo nunca consulta a configuração:
 * para os demais módulos, lê as ferramentas da equipe uma vez por chamada.
 *
 * A mensagem não revela o nome do módulo: o detalhe fica fora da interface.
 */
export async function assertModuleUsable(
  teamTools: TeamToolsRepository,
  organizationId: OrganizationId,
  policy: ModuleUsePolicy,
): Promise<void> {
  if (getModule(policy.module).core) return

  const settings = await teamTools.getSettings(organizationId)
  const refusal = moduleUseRefusal(moduleStateOf(settings.modules, policy.module), {
    creates: policy.creates === true,
  })
  if (refusal !== null) throw REFUSAL_ERRORS[refusal]()
}
