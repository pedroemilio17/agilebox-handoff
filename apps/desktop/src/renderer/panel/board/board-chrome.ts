import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { TaskScope } from './task-scope'

/**
 * O que o quadro precisa saber da casca (PanelShell) para montar o cabeçalho da página e a faixa
 * de controles do design: projeto atual, escopo "Minhas tarefas | Equipe" e o aviso do gestor.
 * Sem provedor (testes isolados do quadro) o quadro mostra só o que tem em mãos.
 */
export interface BoardChrome {
  /** Nome do projeto selecionado; nulo = todos os projetos. */
  readonly projectName: string | null
  readonly taskScope: TaskScope
  readonly onTaskScopeChange: ((scope: TaskScope) => void) | undefined
  /** Faixa "Tarefas de fulano · editando como Gestor", exibida entre os controles e as colunas. */
  readonly managerContext: ReactNode
}

export const BoardChromeContext = createContext<BoardChrome | null>(null)

export function useBoardChrome(): BoardChrome | null {
  return useContext(BoardChromeContext)
}
