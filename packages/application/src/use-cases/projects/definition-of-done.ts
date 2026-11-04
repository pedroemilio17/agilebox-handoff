import {
  addDefinitionItem,
  canManageDefinitionOfDone,
  canSeeProject,
  changedDefinitionItems,
  moveDefinitionItem,
  NotFoundError,
  PermissionDeniedError,
  removeDefinitionItem,
  renameDefinitionItem,
  toDefinitionOfDoneItemId,
  toProjectId,
} from '@agilebox/core'
import type { Actor, DefinitionOfDoneItem, DefinitionOfDoneItemId, Project } from '@agilebox/core'
import type {
  AddDefinitionOfDoneItemInput,
  DefinitionOfDoneItemDto,
  MoveDefinitionOfDoneItemInput,
  RenameDefinitionOfDoneItemInput,
} from '@agilebox/contract'
import { toDefinitionOfDoneItemDto } from '../../mappers'
import type { AppDeps } from '../../deps'

/** Quem vê o projeto lê a definição de pronto; só gestor e criador editam (mesma regra de Membros). */
export class ListDefinitionOfDone {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly projectId: string },
  ): Promise<readonly DefinitionOfDoneItemDto[]> {
    const project = await this.findProject(actor, input.projectId)
    const members = await this.deps.projects.listMembers(actor.organizationId, project.id)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((member) => member.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError('Sem acesso a este projeto')
    const items = await this.deps.definitionOfDone.listByProject(actor.organizationId, project.id)
    return items.map(toDefinitionOfDoneItemDto)
  }

  private async findProject(actor: Actor, projectId: string): Promise<Project> {
    const project = await this.deps.projects.findById(actor.organizationId, toProjectId(projectId))
    if (!project) throw new NotFoundError('Projeto não encontrado')
    return project
  }
}

interface Step {
  readonly items: readonly DefinitionOfDoneItem[]
  readonly removedId?: DefinitionOfDoneItemId
}

abstract class ChangeDefinitionOfDone {
  constructor(protected readonly deps: AppDeps) {}

  protected async manageableProject(actor: Actor, projectId: string): Promise<Project> {
    const project = await this.deps.projects.findById(actor.organizationId, toProjectId(projectId))
    if (!project) throw new NotFoundError('Projeto não encontrado')
    if (!canManageDefinitionOfDone(actor, project))
      throw new PermissionDeniedError(
        'Só o gestor ou o criador do projeto edita a definição de pronto',
      )
    return project
  }

  /** Lê, aplica a regra e grava só o que mudou, tudo na mesma transação. */
  protected async change(
    actor: Actor,
    project: Project,
    transform: (items: readonly DefinitionOfDoneItem[]) => Step,
  ): Promise<readonly DefinitionOfDoneItemDto[]> {
    const items = await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      const current = await repositories.definitionOfDone.listByProject(
        actor.organizationId,
        project.id,
      )
      const step = transform(current)
      if (step.removedId !== undefined)
        await repositories.definitionOfDone.remove(actor.organizationId, step.removedId)
      await repositories.definitionOfDone.saveMany(
        actor.organizationId,
        changedDefinitionItems(current, step.items),
      )
      return step.items
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'project',
      ids: [project.id],
    })
    return items.map(toDefinitionOfDoneItemDto)
  }
}

export class AddDefinitionOfDoneItem extends ChangeDefinitionOfDone {
  async execute(actor: Actor, input: AddDefinitionOfDoneItemInput) {
    const project = await this.manageableProject(actor, input.projectId)
    const id = toDefinitionOfDoneItemId(await this.deps.idGenerator.generate(actor.organizationId))
    return this.change(actor, project, (items) => ({
      items: addDefinitionItem(items, {
        id,
        organizationId: actor.organizationId,
        projectId: project.id,
        title: input.title,
      }),
    }))
  }
}

export class RenameDefinitionOfDoneItem extends ChangeDefinitionOfDone {
  async execute(actor: Actor, input: RenameDefinitionOfDoneItemInput) {
    const project = await this.manageableProject(actor, input.projectId)
    const itemId = toDefinitionOfDoneItemId(input.itemId)
    return this.change(actor, project, (items) => ({
      items: renameDefinitionItem(items, itemId, input.title),
    }))
  }
}

export class RemoveDefinitionOfDoneItem extends ChangeDefinitionOfDone {
  async execute(actor: Actor, input: { readonly projectId: string; readonly itemId: string }) {
    const project = await this.manageableProject(actor, input.projectId)
    const itemId = toDefinitionOfDoneItemId(input.itemId)
    return this.change(actor, project, (items) => {
      const { removed, remaining } = removeDefinitionItem(items, itemId)
      return { items: remaining, removedId: removed.id }
    })
  }
}

export class MoveDefinitionOfDoneItem extends ChangeDefinitionOfDone {
  async execute(actor: Actor, input: MoveDefinitionOfDoneItemInput) {
    const project = await this.manageableProject(actor, input.projectId)
    const itemId = toDefinitionOfDoneItemId(input.itemId)
    return this.change(actor, project, (items) => ({
      items: moveDefinitionItem(items, itemId, input.position),
    }))
  }
}
