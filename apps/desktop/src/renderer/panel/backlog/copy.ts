/** Textos da tela Backlog (quadros 09 e 10). Próprios da pasta: o `panel/copy.ts` fica para as outras telas. */
export const backlogCopy = {
  loading: 'Carregando backlog…',
  loadError: 'Não foi possível carregar o backlog.',
  actionError: 'Não foi possível concluir a ação.',
  listLabel: 'Backlog em ordem de prioridade',
  filterLabel: 'Filtrar por projeto',
  filterAll: 'Todos',
  managerHint: 'Você reordena como gestor',
  collaboratorHint: 'Só o gestor reordena',
  lockedHandle: 'Só o gestor reordena',
  newTask: 'Nova tarefa',
  reorderHandle: (title: string) => `Reordenar ${title}`,
  dragHint: 'Arraste pela alça',
  moreActions: (title: string) => `Mais ações para ${title}`,
  moveTop: 'Mover para o topo',
  moveEnd: 'Mover para o fim',
  takeToBoard: 'Levar ao Quadro',
  takeToBoardFor: (title: string) => `Levar ${title} ao Quadro`,
  takenToBoard: (title: string) => `Tarefa ${title} levada ao quadro`,
  noCriteria: 'sem critérios',
  noResponsible: 'Sem responsável',
  emptyValue: '—',
  emptyTitle: 'Nada esperando por aqui',
  emptyDescription:
    'Tarefas fora do quadro ficam nesta lista, na ordem em que o time vai pegá-las.',
  emptyProject: 'Nenhuma tarefa deste projeto no backlog.',
  movedTo: (title: string, position: number, total: number) =>
    `Tarefa ${title} movida para a posição ${position} de ${total}`,
  movedHeadline: (title: string, direction: 'subiu' | 'desceu', position: number) =>
    `${title} ${direction} para a posição ${position}`,
  scopeOne: 'Vale para o time, e o outro participante vê a mudança.',
  scopeMany: (count: number) => `Vale para o time, e os ${count} participantes veem a mudança.`,
  alreadyTop: (title: string) => `Tarefa ${title} já está no topo`,
  alreadyEnd: (title: string) => `Tarefa ${title} já está no fim`,
  createdInBacklog: (title: string) => `Tarefa ${title} criada no fim do backlog`,
  undo: 'Desfazer',
  footerKeys: 'Alt + ↑ ↓ move a linha em foco',
  reorderRoleDescription: 'item ordenável',
  /** Instrução que o dnd-kit lê na alça. Só o que funciona: arrastar com ponteiro, Alt+setas, menu. */
  dragInstructions:
    'Para mudar a ordem, arraste a alça com o ponteiro. Pelo teclado, segure Alt e aperte ↑ ou ↓ com a linha em foco, ou use o menu "⋯".',
  dragStarted: (title: string) =>
    `Tarefa ${title} selecionada para arrastar. Mova o ponteiro para escolher a nova posição.`,
  dragOver: (title: string, position: number, total: number) =>
    `Tarefa ${title} sobre a posição ${position} de ${total}`,
  dragNoTarget: (title: string) => `Tarefa ${title} fora da lista`,
  dragEnded: (title: string, position: number, total: number) =>
    `Tarefa ${title} solta na posição ${position} de ${total}`,
  dragEndedNowhere: (title: string) => `Tarefa ${title} solta fora da lista. A ordem não mudou.`,
  dragCancelled: (title: string) => `Arraste de ${title} cancelado. A ordem não mudou.`,
  footerTeam: 'A ordem vale para o time inteiro, em todos os projetos.',
} as const
