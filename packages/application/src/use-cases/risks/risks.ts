import {
  canEditProjectStructure,
  canSeeProject,
  ConflictError,
  createRisk,
  moduleStateOf,
  NotFoundError,
  parseRiskStatus,
  PermissionDeniedError,
  sortRisksByScore,
  toDeliverableId,
  toProjectId,
  toRiskId,
  toUserId,
  updateRisk,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  DeliverableId,
  OrganizationId,
  Project,
  ProjectId,
  Risk,
  RiskId,
  UserId,
} from '@agilebox/core'
import type { RiskDto, RiskListItemDto, RisksListDto } from '@agilebox/contract'
import { toRiskDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { linkedDeliverable } from '../wbs/wbs-scope'
import { loadOwnerNames } from '../impediments/impediment-refs'

const VIEW_DENIED = 'Sem acesso a este projeto'
const RISK_DENIED = 'Sem permissão para editar os riscos deste projeto'
const RISK_ARCHIVED =
  'Projeto arquivado não aceita mudanças nos riscos. Desarquive o projeto para editar.'
const OWNER_NOT_MEMBER = 'O dono do risco precisa ser membro do projeto'
const WBS_OFF = 'Ligue a EAP no projeto para associar o risco a uma entrega'
const OTHER_PROJECT = 'A entrega do risco é de outro projeto'

async function riskOf(
  deps: Pick<AppDeps, 'risks'>,
  organizationId: OrganizationId,
  riskId: RiskId,
) {
  const risk = await deps.risks.findById(organizationId, riskId)
  if (!risk) throw new NotFoundError('Risco não encontrado')
  return risk
}

/**
 * Projeto de uma alteração de risco: existe, o ator é gestor ou criador (a mesma regra da EAP e dos
 * marcos, `canEditProjectStructure`), e o projeto não está arquivado. Nessa ordem.
 */
async function writableProject(
  deps: Pick<AppDeps, 'projects'>,
  actor: Actor,
  projectId: ProjectId,
): Promise<Project> {
  const project = await deps.projects.findById(actor.organizationId, projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  if (!canEditProjectStructure(actor, project)) throw new PermissionDeniedError(RISK_DENIED)
  if (project.archivedAt !== null) throw new ConflictError(RISK_ARCHIVED)
  return project
}

/** Dono e entrega de um risco: o dono é membro do projeto; a entrega é do mesmo projeto e exige a EAP ligada. */
async function checkLinks(
  deps: Pick<AppDeps, 'projects' | 'projectModules' | 'deliverables'>,
  organizationId: OrganizationId,
  projectId: ProjectId,
  links: { readonly ownerId?: UserId | null; readonly deliverableId?: DeliverableId | null },
): Promise<void> {
  if (links.ownerId) {
    const members = await deps.projects.listMembers(organizationId, projectId)
    if (!members.some((item) => item.userId === links.ownerId))
      throw new ValidationError(OWNER_NOT_MEMBER)
  }
  if (links.deliverableId) {
    const modules = await deps.projectModules.list(organizationId, projectId)
    if (moduleStateOf(modules, 'wbs') === 'disabled') throw new ValidationError(WBS_OFF)
    await linkedDeliverable(deps, organizationId, projectId, links.deliverableId, OTHER_PROJECT)
  }
}

function ownerIdOrNull(value: string | null | undefined): UserId | null | undefined {
  if (value === undefined) return undefined
  return value === null ? null : toUserId(value)
}

function deliverableIdOrNull(value: string | null | undefined): DeliverableId | null | undefined {
  if (value === undefined) return undefined
  return value === null ? null : toDeliverableId(value)
}

/** Nome do dono de cada risco, em lote. */
async function ownerNamesOf(
  deps: Pick<AppDeps, 'users'>,
  organizationId: OrganizationId,
  risks: readonly Risk[],
): Promise<ReadonlyMap<UserId, string>> {
  return loadOwnerNames(
    deps,
    organizationId,
    risks.map((risk) => risk.ownerId),
  )
}

/** Dto de um risco com o nome do dono resolvido. */
async function dtoOf(
  deps: Pick<AppDeps, 'users'>,
  organizationId: OrganizationId,
  risk: Risk,
): Promise<RiskDto> {
  const names = await ownerNamesOf(deps, organizationId, [risk])
  return toRiskDto(risk, risk.ownerId === null ? null : (names.get(risk.ownerId) ?? null))
}

/**
 * Lista os riscos do projeto, do maior para o menor (probabilidade × impacto). Quem vê o projeto lê;
 * `canEdit` diz se a tela mostra as ações. O título da entrega só vem com o módulo `wbs` ligado.
 */
export class ListRisks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<RisksListDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(organizationId, projectId)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((item) => item.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError(VIEW_DENIED)

    const [risks, modules] = await Promise.all([
      this.deps.risks.listByProject(organizationId, projectId),
      this.deps.projectModules.list(organizationId, projectId),
    ])
    const wbsVisible = moduleStateOf(modules, 'wbs') !== 'disabled'
    const sorted = sortRisksByScore(risks)
    const names = await ownerNamesOf(this.deps, organizationId, sorted)
    const items: RiskListItemDto[] = await Promise.all(
      sorted.map(async (risk) => {
        const deliverable =
          wbsVisible && risk.deliverableId !== null
            ? await this.deps.deliverables.findById(organizationId, risk.deliverableId)
            : null
        return {
          ...toRiskDto(risk, risk.ownerId === null ? null : (names.get(risk.ownerId) ?? null)),
          deliverableTitle: deliverable?.title ?? null,
        }
      }),
    )
    return {
      projectId,
      canEdit: canEditProjectStructure(actor, project) && project.archivedAt === null,
      risks: items,
    }
  }
}

/** Cria risco (gestor ou criador do projeto). Situação nasce aberta. */
export class CreateRisk {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: {
      readonly projectId: string
      readonly title: string
      readonly description: string | null
      readonly probability: number
      readonly impact: number
      readonly response: string | null
      readonly ownerId: string | null
      readonly deliverableId: string | null
    },
  ): Promise<RiskDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    await writableProject(this.deps, actor, projectId)
    const ownerId = ownerIdOrNull(input.ownerId) ?? null
    const deliverableId = deliverableIdOrNull(input.deliverableId) ?? null
    await checkLinks(this.deps, organizationId, projectId, { ownerId, deliverableId })
    const now = await this.deps.clock.now(organizationId)
    const created = await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const risk = createRisk({
        id: toRiskId(await this.deps.idGenerator.generate(organizationId)),
        organizationId,
        projectId,
        title: input.title,
        description: input.description,
        probability: input.probability,
        impact: input.impact,
        response: input.response,
        ownerId,
        deliverableId,
        createdBy: actor.userId,
        createdAt: now,
      })
      await repos.risks.save(organizationId, risk)
      return risk
    })
    await this.deps.changeNotifier.publish(organizationId, { kind: 'project', ids: [projectId] })
    return dtoOf(this.deps, organizationId, created)
  }
}

/** Edita o risco. Campo ausente não muda; dono ou entrega nulos desligam o vínculo. */
export class UpdateRisk {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: {
      readonly riskId: string
      readonly title?: string | undefined
      readonly description?: string | null | undefined
      readonly probability?: number | undefined
      readonly impact?: number | undefined
      readonly response?: string | null | undefined
      readonly ownerId?: string | null | undefined
      readonly deliverableId?: string | null | undefined
      readonly status?: string | undefined
    },
  ): Promise<RiskDto> {
    const organizationId = actor.organizationId
    const risk = await riskOf(this.deps, organizationId, toRiskId(input.riskId))
    await writableProject(this.deps, actor, risk.projectId)
    const ownerId = ownerIdOrNull(input.ownerId)
    const deliverableId = deliverableIdOrNull(input.deliverableId)
    await checkLinks(this.deps, organizationId, risk.projectId, {
      ...(ownerId ? { ownerId } : {}),
      ...(deliverableId ? { deliverableId } : {}),
    })
    const now = await this.deps.clock.now(organizationId)
    // Só entra no patch o que veio: campo ausente não muda (ver `RiskUpdate`).
    const updated = updateRisk(
      risk,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.impact !== undefined ? { impact: input.impact } : {}),
        ...(input.response !== undefined ? { response: input.response } : {}),
        ...(ownerId !== undefined ? { ownerId } : {}),
        ...(deliverableId !== undefined ? { deliverableId } : {}),
        ...(input.status !== undefined ? { status: parseRiskStatus(input.status) } : {}),
      },
      now,
    )
    await this.deps.unitOfWork.run(organizationId, (repos) =>
      repos.risks.save(organizationId, updated),
    )
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'project',
      ids: [risk.projectId],
    })
    return dtoOf(this.deps, organizationId, updated)
  }
}

/** Remove o risco. Nada depende dele, então não há recusa por vínculo. */
export class RemoveRisk {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly riskId: string }): Promise<void> {
    const organizationId = actor.organizationId
    const risk = await riskOf(this.deps, organizationId, toRiskId(input.riskId))
    await writableProject(this.deps, actor, risk.projectId)
    await this.deps.unitOfWork.run(organizationId, (repos) =>
      repos.risks.delete(organizationId, risk.id),
    )
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'project',
      ids: [risk.projectId],
    })
  }
}
