import {
  ConflictError,
  getModule,
  moduleStateOf,
  moduleUseRefusal,
  PermissionDeniedError,
  toDeliverableId,
  toImpedimentId,
  toMilestoneId,
  toProjectId,
  toSprintId,
  toTaskId,
} from '@agilebox/core'
import type { ModuleId, ModuleState, OrganizationId, ProjectId } from '@agilebox/core'
import type {
  DeliverableRepository,
  ImpedimentRepository,
  MilestoneRepository,
  ProjectModulesRepository,
  ProjectRepository,
  SprintRepository,
  TaskRepository,
  TeamToolsRepository,
} from './ports'

/**
 * De onde sai o projeto de um caso de uso, nos argumentos de `execute(context, ...args)` (ADR-10).
 * - `'none'`: o caso de uso não pertence a um projeto (agenda, check-in, limites do quadro,
 *   impedimentos da organização, reuniões). Vale a regra da organização (`assertProjectModuleUsable`).
 * - `{ from: campo }`: o campo fica no primeiro argumento (o objeto de entrada). Se o campo não vier
 *   (ex.: quadro sem projeto), vale a regra da organização. Se vier e não existir nesta organização,
 *   o guard não recusa: o próprio caso de uso responde `NotFoundError`.
 */
export type ProjectResolution =
  | 'none'
  | { readonly from: 'projectId' }
  | { readonly from: 'taskId' }
  | { readonly from: 'sprintId' }
  | { readonly from: 'impedimentId' }
  | { readonly from: 'deliverableId' }
  | { readonly from: 'milestoneId' }
  | { readonly from: 'successorId' }

/** Módulo de um caso de uso, se ele cria itens novos desse módulo, e de onde sai o projeto. */
export interface ModuleUsePolicy {
  readonly module: ModuleId
  /** Cria item do módulo: recusado enquanto o módulo está encerrando (`winding_down`). */
  readonly creates?: boolean
  readonly project: ProjectResolution
}

/**
 * Mapa de módulos dos casos de uso registrados em `createUseCases` (todas as folhas que passam pela
 * fronteira `forTenant`). Cada caso de uso declara seu módulo, se cria itens e de onde sai o projeto
 * (`project`). O guard recusa a chamada conforme o estado do módulo no projeto (ADR-10); sem projeto
 * nos argumentos, conforme a organização (`assertProjectModuleUsable`).
 *
 * Decisões por caso de uso que não são óbvias:
 * - `dashboard.get` e `dashboard.exportSummary` ficam em `core`: a resposta mistura estatísticas do
 *   núcleo (status, atrasadas, colaboradores) com insights de fluxo. Com `flowMetrics` na regra,
 *   desligar o módulo tiraria o painel inteiro do gestor. Os insights de fluxo não são calculados
 *   nem devolvidos quando `flowMetrics` está desligado (o caso de uso lê a equipe, como o guard).
 * - `daily.save` não é `creates` no mapa: cria a daily do dia (recusado no encerramento) ou edita a
 *   que já existe (segue permitido). A diferença é checada dentro do caso de uso, com
 *   `assertProjectModuleUsable(..., { creates: true })` só quando não há daily na data (PLANO-2.0, linha 65).
 *   Daily não tem projeto: `project: 'none'`, regra da organização.
 * - `participations.setHours` e `setRate` ficam em `core`: horas e valor/hora alimentam o custo,
 *   que é regra do produto e não da ferramenta de estimativa (`estimates.hours`).
 * - `projects.definitionOfDone.*` fica em `core`: a definição de pronto é do projeto, não é o módulo
 *   `acceptance` (critérios de aceitação, por tarefa).
 * - `tasks.setEstimate` tem módulo próprio (`estimates.hours`) porque `tasks.update` é do núcleo e o
 *   guard não olha campo a campo.
 * - `teamTools.*` fica em `core`: a gestão das ferramentas não pode ser desligada por ela mesma.
 * - `project` (ADR-10): `tasks.*`, participações e impedimentos saem do `taskId` (ou do impedimento,
 *   que leva à tarefa); sprints saem do `sprintId`; backlog e sprints.list/create, do `projectId`.
 *   EAP e marcos: entregas saem do `deliverableId` (e criar, do `projectId`); marcos saem do
 *   `milestoneId` (e criar, do `projectId`). `tasks.setDeliverable` segue a tarefa.
 *   Cronograma (ADR-10): `tasks.setStart` sai do `taskId`; dependências saem da sucessora
 *   (`successorId`, a tarefa que muda), e a leitura do cronograma, do `projectId`.
 *   Agenda, check-in, limites do quadro, impedimentos da organização e ações de retro não têm
 *   projeto: `'none'`, a regra da organização. `tasks.getBoardFlow` tem `projectId` opcional: sem ele,
 *   é o quadro inteiro e vale a regra da organização.
 */
export const USE_CASE_MODULES = {
  'session.listUsers': { module: 'core', project: 'none' },

  'users.setDefaultRate': { module: 'core', project: 'none' },

  'contributors.list': { module: 'core', project: 'none' },
  'contributors.create': { module: 'core', project: 'none' },
  'contributors.setDefaultRate': { module: 'core', project: 'none' },

  'projects.listProjects': { module: 'core', project: 'none' },
  'projects.createProject': { module: 'core', project: 'none' },
  'projects.createWithSetup': { module: 'core', project: 'none' },
  'projects.listMembers': { module: 'core', project: 'none' },
  'projects.addMember': { module: 'core', project: 'none' },
  'projects.removeMember': { module: 'core', project: 'none' },
  'projects.archive': { module: 'core', project: 'none' },
  'projects.unarchive': { module: 'core', project: 'none' },
  'projects.rename': { module: 'core', project: 'none' },
  'projects.definitionOfDone.list': { module: 'core', project: 'none' },
  'projects.definitionOfDone.add': { module: 'core', project: 'none' },
  'projects.definitionOfDone.rename': { module: 'core', project: 'none' },
  'projects.definitionOfDone.remove': { module: 'core', project: 'none' },
  'projects.definitionOfDone.move': { module: 'core', project: 'none' },

  'tasks.create': { module: 'core', project: 'none' },
  'tasks.getDetail': { module: 'core', project: 'none' },
  'tasks.update': { module: 'core', project: 'none' },
  'tasks.move': { module: 'core', project: 'none' },
  'tasks.block': { module: 'impediments', creates: true, project: { from: 'taskId' } },
  'tasks.unblock': { module: 'impediments', project: { from: 'taskId' } },
  // Impedimentos (M5.2a): abrir é `tasks.block` (creates, recusado no encerramento). Listar, atribuir e
  // resolver seguem no encerramento, como o que já existe.
  'impediments.list': { module: 'impediments', project: 'none' },
  'impediments.assign': { module: 'impediments', project: { from: 'impedimentId' } },
  'impediments.resolve': { module: 'impediments', project: { from: 'impedimentId' } },
  'tasks.archive': { module: 'core', project: 'none' },
  'tasks.unarchive': { module: 'core', project: 'none' },
  // Critérios de aceitação (M3.2): o módulo `acceptance` guarda a lista; adicionar é criar (encerrando, recusa).
  'tasks.criteria.add': { module: 'acceptance', creates: true, project: { from: 'taskId' } },
  'tasks.criteria.toggle': { module: 'acceptance', project: { from: 'taskId' } },
  'tasks.criteria.rename': { module: 'acceptance', project: { from: 'taskId' } },
  'tasks.criteria.remove': { module: 'acceptance', project: { from: 'taskId' } },
  'tasks.criteria.move': { module: 'acceptance', project: { from: 'taskId' } },
  'tasks.setEstimate': { module: 'estimates.hours', project: { from: 'taskId' } },
  'tasks.checklist.add': { module: 'subtasks', creates: true, project: { from: 'taskId' } },
  'tasks.checklist.toggle': { module: 'subtasks', project: { from: 'taskId' } },
  'tasks.checklist.rename': { module: 'subtasks', project: { from: 'taskId' } },
  'tasks.checklist.remove': { module: 'subtasks', project: { from: 'taskId' } },
  'tasks.checklist.move': { module: 'subtasks', project: { from: 'taskId' } },
  'tasks.comments.add': { module: 'core', project: 'none' },
  'tasks.comments.edit': { module: 'core', project: 'none' },
  'tasks.comments.remove': { module: 'core', project: 'none' },
  'tasks.listBoard': { module: 'core', project: 'none' },
  'tasks.getBoardFlow': { module: 'flowMetrics', project: { from: 'projectId' } },
  'tasks.listTeamBoard': { module: 'core', project: 'none' },
  'tasks.listRecent': { module: 'core', project: 'none' },
  'tasks.listFrequent': { module: 'core', project: 'none' },
  'tasks.search': { module: 'core', project: 'none' },
  'tasks.recordOpen': { module: 'core', project: 'none' },

  // Backlog (M3.1): o módulo `backlog` guarda os itens fora do quadro. Encerrando, não aceita item novo.
  'backlog.list': { module: 'backlog', project: { from: 'projectId' } },
  'backlog.add': { module: 'backlog', creates: true, project: { from: 'projectId' } },
  'backlog.reorder': { module: 'backlog', project: { from: 'taskId' } },
  'backlog.pull': { module: 'backlog', project: { from: 'taskId' } },
  'backlog.sendBack': { module: 'backlog', project: { from: 'taskId' } },

  'participations.add': { module: 'core', project: 'none' },
  'participations.remove': { module: 'core', project: 'none' },
  'participations.setHours': { module: 'core', project: 'none' },
  'participations.setRate': { module: 'core', project: 'none' },

  'timeline.list': { module: 'core', project: 'none' },

  'dashboard.get': { module: 'core', project: 'none' },
  'dashboard.exportSummary': { module: 'core', project: 'none' },

  'boardSettings.get': { module: 'wip', project: 'none' },
  'boardSettings.setWipLimits': { module: 'wip', project: 'none' },

  'daily.getToday': { module: 'checkins', project: 'none' },
  'daily.save': { module: 'checkins', project: 'none' },
  'daily.listForDate': { module: 'checkins', project: 'none' },
  'daily.getForUser': { module: 'checkins', project: 'none' },
  // Sugestão do check-in (M5.1): só leitura, então segue no encerramento (winding_down).
  'daily.suggestSummary': { module: 'checkins', project: 'none' },

  'meetings.listRange': { module: 'agenda', project: 'none' },
  'meetings.listUpcoming': { module: 'agenda', project: 'none' },
  'meetings.create': { module: 'agenda', creates: true, project: 'none' },
  'meetings.update': { module: 'agenda', project: 'none' },
  'meetings.delete': { module: 'agenda', project: 'none' },
  'meetings.retroActions.list': { module: 'reviewRetro', project: 'none' },
  'meetings.retroActions.add': { module: 'reviewRetro', creates: true, project: 'none' },
  'meetings.retroActions.update': { module: 'reviewRetro', project: 'none' },
  'meetings.retroActions.toggle': { module: 'reviewRetro', project: 'none' },
  'meetings.retroActions.remove': { module: 'reviewRetro', project: 'none' },

  // A gestão das ferramentas nunca pode ser desligada: fica no núcleo (PLANO-2.0, regra 6).
  'teamTools.get': { module: 'core', project: 'none' },
  'teamTools.previewChange': { module: 'core', project: 'none' },
  'teamTools.applyChange': { module: 'core', project: 'none' },
  'teamTools.completeWindDown': { module: 'core', project: 'none' },
  'teamTools.setLevel': { module: 'core', project: 'none' },
  'teamTools.applyPreset': { module: 'core', project: 'none' },
  'teamTools.setModuleConfig': { module: 'core', project: 'none' },

  // Módulos por projeto (ADR-10): a gestão deles fica no núcleo, como a das ferramentas da equipe.
  'projectModules.get': { module: 'core', project: 'none' },
  'projectModules.change': { module: 'core', project: 'none' },
  // Configuração do módulo neste projeto (ADR-10): o módulo é checado pelo próprio caso de uso.
  'projectModules.setConfig': { module: 'core', project: { from: 'projectId' } },
  // Estado dos módulos da organização (barra lateral sem projeto selecionado): só leitura agregada.
  'projectModules.getOrganization': { module: 'core', project: 'none' },

  // Guia de alimentação (ADR-10): leitura e dispensa do cartão. Sempre no núcleo: o guia nunca
  // bloqueia nada, e a trilha já sai só dos módulos ativos do projeto.
  'guide.get': { module: 'core', project: { from: 'projectId' } },
  'guide.dismissCard': { module: 'core', project: { from: 'projectId' } },
  'guide.resolveWelcome': { module: 'core', project: { from: 'projectId' } },

  // Sprints (M4.2): encerrando, não aceita sprint nova, item novo nem início (creates). Encerrar a
  // ativa, remover item, editar e consultar seguem; descartar rascunho não cria nada.
  'sprints.list': { module: 'sprints', project: { from: 'projectId' } },
  'sprints.get': { module: 'sprints', project: { from: 'sprintId' } },
  'sprints.create': { module: 'sprints', creates: true, project: { from: 'projectId' } },
  'sprints.update': { module: 'sprints', project: { from: 'sprintId' } },
  'sprints.start': { module: 'sprints', creates: true, project: { from: 'sprintId' } },
  'sprints.close': { module: 'sprints', project: { from: 'sprintId' } },
  'sprints.discard': { module: 'sprints', project: { from: 'sprintId' } },
  'sprints.addTask': { module: 'sprints', creates: true, project: { from: 'sprintId' } },
  'sprints.removeTask': { module: 'sprints', project: { from: 'sprintId' } },

  // EAP (ADR-10): criar entrega é criar item do módulo (encerrando, recusa). Renomear, mover, remover
  // e ler seguem. Ligar tarefa a entrega é editar a tarefa, então usa o módulo da EAP e a tarefa.
  'wbs.get': { module: 'wbs', project: { from: 'projectId' } },
  'wbs.createDeliverable': { module: 'wbs', creates: true, project: { from: 'projectId' } },
  'wbs.renameDeliverable': { module: 'wbs', project: { from: 'deliverableId' } },
  'wbs.moveDeliverable': { module: 'wbs', project: { from: 'deliverableId' } },
  'wbs.removeDeliverable': { module: 'wbs', project: { from: 'deliverableId' } },
  'tasks.setDeliverable': { module: 'wbs', project: { from: 'taskId' } },

  // Marcos (ADR-10): criar marco é criar item do módulo (encerrando, recusa). Editar e remover seguem.
  'milestones.list': { module: 'milestones', project: { from: 'projectId' } },
  'milestones.create': { module: 'milestones', creates: true, project: { from: 'projectId' } },
  'milestones.update': { module: 'milestones', project: { from: 'milestoneId' } },
  'milestones.remove': { module: 'milestones', project: { from: 'milestoneId' } },

  // Cronograma (ADR-10): início da tarefa, dependências término→início e a leitura. Criar dependência é
  // criar item do módulo (encerrando, recusa). Remover e ler seguem.
  'tasks.setStart': { module: 'schedule', project: { from: 'taskId' } },
  'schedule.get': { module: 'schedule', project: { from: 'projectId' } },
  'schedule.addDependency': { module: 'schedule', creates: true, project: { from: 'successorId' } },
  'schedule.removeDependency': { module: 'schedule', project: { from: 'successorId' } },
  // Acompanhamento (ADR-10): leitura do projeto, no módulo do cronograma.
  'tracking.get': { module: 'schedule', project: { from: 'projectId' } },
  // Burndown e velocidade (ADR-10): leitura do projeto, no módulo `burndown` (exige sprints e horas).
  'burndown.get': { module: 'burndown', project: { from: 'projectId' } },
  // Métricas de fluxo (ADR-10): leitura do projeto, no módulo `flowMetrics` (lead time, ciclo e vazão).
  'flowMetrics.get': { module: 'flowMetrics', project: { from: 'projectId' } },
} as const satisfies Record<string, ModuleUsePolicy>

/** Caminho de um caso de uso registrado, no formato de `USE_CASE_MODULES` (ex.: `tasks.create`). */
export type UseCasePath = keyof typeof USE_CASE_MODULES

const REFUSAL_ERRORS = {
  module_disabled: () =>
    new PermissionDeniedError('Esta ferramenta está desativada para a equipe.'),
  module_winding_down: () =>
    new ConflictError('Esta ferramenta está sendo encerrada: não aceita itens novos.'),
} as const

/** Repositórios que o guard lê para achar o projeto e o estado do módulo. */
export interface ModuleGuardPorts {
  readonly teamTools: TeamToolsRepository
  readonly projects: ProjectRepository
  readonly projectModules: ProjectModulesRepository
  readonly tasks: TaskRepository
  readonly sprints: SprintRepository
  readonly impediments: ImpedimentRepository
  readonly deliverables: DeliverableRepository
  readonly milestones: MilestoneRepository
}

/** Ordem de força dos estados: o melhor estado entre vários projetos é o que vale. */
const STATE_RANK: Record<ModuleState, number> = { disabled: 0, winding_down: 1, active: 2 }

function strongestState(states: readonly ModuleState[]): ModuleState {
  return states.reduce<ModuleState>(
    (best, state) => (STATE_RANK[state] > STATE_RANK[best] ? state : best),
    'disabled',
  )
}

/** Valor de um campo do primeiro argumento (o objeto de entrada), se for texto. */
function fieldOf(first: unknown, field: string): string | undefined {
  if (typeof first !== 'object' || first === null) return undefined
  const value = (first as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : undefined
}

/** Converte um id de entrada; id mal formado não acha nada, então vira `null`. */
function parseIdOrNull<T>(parse: (value: string) => T, value: string): T | null {
  try {
    return parse(value)
  } catch {
    return null
  }
}

/** Alvo da checagem: um projeto, a regra da organização, ou um alvo que não existe nela. */
type ModuleTarget =
  | { readonly kind: 'project'; readonly projectId: ProjectId }
  | { readonly kind: 'organization' }
  | { readonly kind: 'missing' }

async function targetOf(
  ports: ModuleGuardPorts,
  organizationId: OrganizationId,
  resolution: ProjectResolution,
  args: readonly unknown[],
): Promise<ModuleTarget> {
  if (resolution === 'none') return { kind: 'organization' }
  const first = args[0]
  const raw = fieldOf(first, resolution.from)
  if (raw === undefined) return { kind: 'organization' }

  const project = (projectId: ProjectId): ModuleTarget => ({ kind: 'project', projectId })
  const missing: ModuleTarget = { kind: 'missing' }

  switch (resolution.from) {
    case 'projectId': {
      const projectId = parseIdOrNull(toProjectId, raw)
      return projectId === null ? missing : project(projectId)
    }
    case 'taskId': {
      const taskId = parseIdOrNull(toTaskId, raw)
      const task = taskId === null ? null : await ports.tasks.findById(organizationId, taskId)
      return task === null ? missing : project(task.projectId)
    }
    case 'sprintId': {
      const sprintId = parseIdOrNull(toSprintId, raw)
      const sprint =
        sprintId === null ? null : await ports.sprints.findById(organizationId, sprintId)
      return sprint === null ? missing : project(sprint.projectId)
    }
    case 'impedimentId': {
      const impedimentId = parseIdOrNull(toImpedimentId, raw)
      const impediment =
        impedimentId === null
          ? null
          : await ports.impediments.findById(organizationId, impedimentId)
      if (impediment === null) return missing
      const task = await ports.tasks.findById(organizationId, impediment.taskId)
      return task === null ? missing : project(task.projectId)
    }
    case 'deliverableId': {
      const deliverableId = parseIdOrNull(toDeliverableId, raw)
      const deliverable =
        deliverableId === null
          ? null
          : await ports.deliverables.findById(organizationId, deliverableId)
      return deliverable === null ? missing : project(deliverable.projectId)
    }
    case 'milestoneId': {
      const milestoneId = parseIdOrNull(toMilestoneId, raw)
      const milestone =
        milestoneId === null ? null : await ports.milestones.findById(organizationId, milestoneId)
      return milestone === null ? missing : project(milestone.projectId)
    }
    case 'successorId': {
      const successorId = parseIdOrNull(toTaskId, raw)
      const successor =
        successorId === null ? null : await ports.tasks.findById(organizationId, successorId)
      return successor === null ? missing : project(successor.projectId)
    }
  }
}

/**
 * Estado efetivo do módulo para o alvo, ou `undefined` quando o alvo não existe nesta organização
 * (o caso de uso responde `NotFoundError`; o guard não recusa nem revela que o projeto existe).
 */
async function effectiveStateOf(
  ports: ModuleGuardPorts,
  organizationId: OrganizationId,
  policy: ModuleUsePolicy,
  args: readonly unknown[],
): Promise<ModuleState | undefined> {
  const target = await targetOf(ports, organizationId, policy.project, args)
  switch (target.kind) {
    case 'missing':
      return undefined
    case 'project': {
      const project = await ports.projects.findById(organizationId, target.projectId)
      if (project === null) return undefined
      const rows = await ports.projectModules.list(organizationId, target.projectId)
      return moduleStateOf(rows, policy.module)
    }
    case 'organization':
      return organizationModuleStateOf(ports, organizationId, policy.module)
  }
}

/**
 * Estado do módulo para a organização inteira: o melhor entre os projetos não arquivados (regra de
 * casos de uso sem projeto, ADR-10). Também serve a leituras de painel que não são de um projeto.
 *
 * Organização sem nenhum projeto ativo (nunca criou projeto, ou todos estão arquivados) segue a
 * regra antiga, com as ferramentas da equipe, para não quebrar quem ainda não tem projeto. Quando
 * existir projeto ativo, a equipe deixa de valer.
 */
export async function organizationModuleStateOf(
  ports: Pick<ModuleGuardPorts, 'teamTools' | 'projectModules'>,
  organizationId: OrganizationId,
  moduleId: ModuleId,
): Promise<ModuleState> {
  const states = await ports.projectModules.statesAcrossProjects(organizationId, moduleId)
  if (states.length > 0) return strongestState(states)
  const settings = await ports.teamTools.getSettings(organizationId)
  return moduleStateOf(settings.modules, moduleId)
}

/**
 * Se o módulo `cost` está ligado (ou encerrando, que só lê) no projeto. Quem devolve valores de custo
 * por projeto (EAP, acompanhamento, custo da tarefa) usa esta leitura, com a mesma regra do guard:
 * projeto sem linha gravada conta como desligado (`moduleStateOf`). As migrações gravam `cost` em
 * todos os projetos existentes, e projeto novo só ganha `cost` pelo wizard ou pelo preset.
 */
export async function projectCostEnabled(
  ports: Pick<ModuleGuardPorts, 'projectModules'>,
  organizationId: OrganizationId,
  projectId: ProjectId,
): Promise<boolean> {
  const rows = await ports.projectModules.list(organizationId, projectId)
  return moduleStateOf(rows, 'cost') !== 'disabled'
}

/**
 * Recusa a chamada se o módulo do caso de uso não está disponível para ela (ADR-10). O módulo vale
 * no projeto do caso de uso (`project_modules`); o núcleo nunca consulta nada. Sem projeto nos
 * argumentos, o módulo vale se estiver ligado (ou encerrando, para o que não cria) em pelo menos um
 * projeto não arquivado da organização. Roda dentro da fronteira `forTenant`, depois de validar o
 * contexto. A equipe (`team_modules`) só entra quando a organização não tem projeto ativo.
 *
 * A mensagem não revela o nome do módulo: o detalhe fica fora da interface.
 */
export async function assertProjectModuleUsable(
  ports: ModuleGuardPorts,
  organizationId: OrganizationId,
  policy: ModuleUsePolicy,
  args: readonly unknown[],
): Promise<void> {
  if (getModule(policy.module).core) return

  const state = await effectiveStateOf(ports, organizationId, policy, args)
  if (state === undefined) return

  const refusal = moduleUseRefusal(state, { creates: policy.creates === true })
  if (refusal !== null) throw REFUSAL_ERRORS[refusal]()
}
