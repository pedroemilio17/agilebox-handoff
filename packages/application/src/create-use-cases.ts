import type { AppDeps } from './deps'
import { CreateProject } from './use-cases/projects/create-project'
import { ListProjects } from './use-cases/projects/list-projects'
import {
  AddProjectMember,
  ListProjectMembers,
  RemoveProjectMember,
} from './use-cases/projects/project-members'
import { GetCurrentActor } from './use-cases/session/get-current-actor'
import { ListSessionUsers } from './use-cases/session/list-users'
import { SwitchUser } from './use-cases/session/switch-user'
import { SetDefaultRate } from './use-cases/users/set-default-rate'

export function createUseCases(deps: AppDeps) {
  return {
    session: {
      getCurrentActor: new GetCurrentActor(deps.actorSession),
      switchUser: new SwitchUser(deps.actorSession, deps.users, deps.changeNotifier),
      listUsers: new ListSessionUsers(deps.users),
    },
    users: {
      setDefaultRate: new SetDefaultRate(deps),
    },
    projects: {
      listProjects: new ListProjects(deps.projects),
      createProject: new CreateProject(deps),
      listMembers: new ListProjectMembers(deps),
      addMember: new AddProjectMember(deps),
      removeMember: new RemoveProjectMember(deps),
    },
  }
}
