import {
  createMilestone,
  NotFoundError,
  toDeliverableId,
  toMilestoneId,
  toProjectId,
  updateMilestone,
} from '@agilebox/core'
import type { Actor, DeliverableId, Milestone, MilestoneId, OrganizationId } from '@agilebox/core'
import type { MilestoneDto } from '@agilebox/contract'
import { toMilestoneDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { recordGuideEvent } from '../guide/record-guide-event'
import { linkedDeliverable, structureProject } from '../wbs/wbs-scope'

const OTHER_PROJECT = 'A entrega do marco é de outro projeto'

async function milestoneOf(
  deps: Pick<AppDeps, 'milestones'>,
  organizationId: OrganizationId,
  milestoneId: MilestoneId,
): Promise<Milestone> {
  const milestone = await deps.milestones.findById(organizationId, milestoneId)
  if (!milestone) throw new NotFoundError('Marco não encontrado')
  return milestone
}

/** Entrega ligada ao marco (qualquer nível da EAP do mesmo projeto), ou nulo para desligar. */
async function linkTarget(
  deps: Pick<AppDeps, 'deliverables'>,
  organizationId: OrganizationId,
  projectId: Milestone['projectId'],
  deliverableId: string | null,
): Promise<DeliverableId | null> {
  if (deliverableId === null) return null
  const linked = await linkedDeliverable(
    deps,
    organizationId,
    projectId,
    toDeliverableId(deliverableId),
    OTHER_PROJECT,
  )
  return linked.id
}

/** Cria marco (gestor ou criador do projeto). Evento do guia: "Marque os marcos". */
export class CreateMilestone {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: {
      readonly projectId: string
      readonly title: string
      readonly dueOn: string
      readonly deliverableId: string | null
      readonly criterion: string | null
    },
  ): Promise<MilestoneDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    await structureProject(this.deps, actor, projectId)
    const deliverableId = await linkTarget(
      this.deps,
      organizationId,
      projectId,
      input.deliverableId,
    )
    const now = await this.deps.clock.now(organizationId)
    const created = await this.deps.unitOfWork.run(organizationId, async (repos) => {
      const milestone = createMilestone({
        id: toMilestoneId(await this.deps.idGenerator.generate(organizationId)),
        organizationId,
        projectId,
        title: input.title,
        dueOn: input.dueOn,
        deliverableId,
        criterion: input.criterion,
        createdBy: actor.userId,
        createdAt: now,
      })
      await repos.milestones.save(organizationId, milestone)
      await recordGuideEvent(repos, actor, projectId, 'milestone.created', now)
      return milestone
    })
    await this.deps.changeNotifier.publish(organizationId, { kind: 'project', ids: [projectId] })
    return toMilestoneDto(created)
  }
}

/** Edita título, data, entrega e critério. Campo ausente não muda; entrega nula desliga. */
export class UpdateMilestone {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: {
      readonly milestoneId: string
      readonly title?: string | undefined
      readonly dueOn?: string | undefined
      readonly deliverableId?: string | null | undefined
      readonly criterion?: string | null | undefined
    },
  ): Promise<MilestoneDto> {
    const organizationId = actor.organizationId
    const milestone = await milestoneOf(this.deps, organizationId, toMilestoneId(input.milestoneId))
    await structureProject(this.deps, actor, milestone.projectId)
    const deliverableId =
      input.deliverableId === undefined
        ? undefined
        : await linkTarget(this.deps, organizationId, milestone.projectId, input.deliverableId)
    // Só entra no patch o que veio: campo ausente não muda (ver `MilestoneUpdate`).
    const updated = updateMilestone(milestone, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.dueOn !== undefined ? { dueOn: input.dueOn } : {}),
      ...(deliverableId !== undefined ? { deliverableId } : {}),
      ...(input.criterion !== undefined ? { criterion: input.criterion } : {}),
    })
    await this.deps.unitOfWork.run(organizationId, (repos) =>
      repos.milestones.save(organizationId, updated),
    )
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'project',
      ids: [milestone.projectId],
    })
    return toMilestoneDto(updated)
  }
}

/** Remove o marco. Nada além dele depende dele, então não há recusa por vínculo. */
export class RemoveMilestone {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly milestoneId: string }): Promise<void> {
    const organizationId = actor.organizationId
    const milestone = await milestoneOf(this.deps, organizationId, toMilestoneId(input.milestoneId))
    await structureProject(this.deps, actor, milestone.projectId)
    await this.deps.unitOfWork.run(organizationId, (repos) =>
      repos.milestones.delete(organizationId, milestone.id),
    )
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'project',
      ids: [milestone.projectId],
    })
  }
}
