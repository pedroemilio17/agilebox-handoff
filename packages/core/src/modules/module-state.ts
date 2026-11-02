import { ValidationError } from '../shared/errors'

/**
 * Estado de um módulo dentro de um time (plano 2.0, "Mudar ferramentas sem quebrar o que está em andamento").
 * - `active`: aceita itens novos e mostra as telas.
 * - `winding_down`: encerrando. Não aceita itens novos; o que já existe segue visível e editável.
 * - `disabled`: desativado. Os dados ficam guardados e voltam ao reativar.
 */
export const MODULE_STATES = ['active', 'winding_down', 'disabled'] as const

export type ModuleState = (typeof MODULE_STATES)[number]

export type ModuleStateEvent = 'startWindingDown' | 'finishWindingDown' | 'reactivate'

const TRANSITIONS: Readonly<Record<ModuleState, Partial<Record<ModuleStateEvent, ModuleState>>>> = {
  active: { startWindingDown: 'winding_down' },
  // Reativar durante o encerramento cancela a saída: é a mesma reversibilidade do plano.
  winding_down: { finishWindingDown: 'disabled', reactivate: 'active' },
  disabled: { reactivate: 'active' },
}

/**
 * Função pura: devolve o novo estado ou lança `ValidationError` se a transição não existe.
 * Não toca em entidades, tarefas, sprints nem em nenhum dado: só muda o estado do módulo.
 */
export function transitionModuleState(state: ModuleState, event: ModuleStateEvent): ModuleState {
  const next = TRANSITIONS[state][event]
  if (next === undefined) {
    throw new ValidationError(
      `Transição inválida: não é possível ${describeEvent(event)} um módulo ${describeState(state)}`,
    )
  }
  return next
}

/** Só o módulo ativo aceita criar itens novos. */
export function canAcceptNewItems(state: ModuleState): boolean {
  return state === 'active'
}

/** Itens que já existem continuam visíveis e editáveis enquanto o módulo não está desativado. */
export function canUseExistingItems(state: ModuleState): boolean {
  return state !== 'disabled'
}

function describeEvent(event: ModuleStateEvent): string {
  switch (event) {
    case 'startWindingDown':
      return 'iniciar o encerramento de'
    case 'finishWindingDown':
      return 'concluir o encerramento de'
    case 'reactivate':
      return 'reativar'
  }
}

function describeState(state: ModuleState): string {
  switch (state) {
    case 'active':
      return 'ativo'
    case 'winding_down':
      return 'em encerramento'
    case 'disabled':
      return 'desativado'
  }
}
