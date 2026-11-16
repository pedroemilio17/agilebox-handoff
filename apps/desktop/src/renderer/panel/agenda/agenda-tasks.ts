import type { AgileBoxApi, TaskDto } from '@agilebox/contract'

type TaskApi = Pick<AgileBoxApi['tasks'], 'listBoard' | 'listTeamBoard'>

/** Junta listas de tarefas sem repetir nenhuma (a primeira ocorrência de cada id vence). */
export function mergeTasksById(...lists: readonly (readonly TaskDto[])[]): TaskDto[] {
  return [...new Map(lists.flat().map((task) => [task.id, task])).values()]
}

/**
 * Tarefas com prazo para a agenda. A consulta muda por perfil, a regra de acesso não:
 * - gestor: todas as tarefas da organização (visão Equipe) somadas às próprias, sem repetir;
 * - colaborador: só as tarefas de que participa (Minhas tarefas). A visão Equipe não entra aqui.
 * O servidor continua decidindo o que cada um pode ver (PLANO 6.1).
 */
export async function loadAgendaTasks(api: TaskApi, isManager: boolean): Promise<TaskDto[]> {
  if (!isManager) return [...(await api.listBoard({})).tasks]
  const [own, team] = await Promise.all([api.listBoard({}), api.listTeamBoard({})])
  return mergeTasksById(team, own.tasks)
}
