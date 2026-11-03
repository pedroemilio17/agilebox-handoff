import { describe, expect, it } from 'vitest'
import {
  countOtherParticipants,
  criteriaLabel,
  dropPlacement,
  formatHours,
  movedHeadline,
  movedNotice,
  neighborPlacement,
  resolveInsertIndex,
  scopeNoticeFor,
  visibleBacklog,
} from './backlog-moves'

const P_A = '01J8Y4G2XK8Z1S6M3Q9W0P0001'
const P_B = '01J8Y4G2XK8Z1S6M3Q9W0P0002'
const ME = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V03'
const BRUNO = '01J8Y4G2XK8Z1S6M3Q9W0A5V04'

/** Backlog de quatro tarefas: A, B, C e D; B é de outro projeto. */
const backlog = [
  { id: 'A', projectId: P_A },
  { id: 'B', projectId: P_B },
  { id: 'C', projectId: P_A },
  { id: 'D', projectId: P_A },
]

describe('visibleBacklog', () => {
  it('mantém a ordem do time e filtra por projeto', () => {
    expect(visibleBacklog(backlog, null).map((item) => item.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(visibleBacklog(backlog, P_A).map((item) => item.id)).toEqual(['A', 'C', 'D'])
  })
})

describe('neighborPlacement (Alt+↑/↓ com filtro ativo)', () => {
  it('sem filtro, troca com o vizinho imediato', () => {
    expect(neighborPlacement(backlog, null, 'B', 'up')).toBe(0)
    expect(neighborPlacement(backlog, null, 'B', 'down')).toBe(2)
  })

  it('com filtro, pula as tarefas de outros projetos e usa a posição global', () => {
    // Filtrado: A, C, D. Subir C troca com A; descer C troca com D.
    expect(neighborPlacement(backlog, P_A, 'C', 'up')).toBe(0)
    expect(neighborPlacement(backlog, P_A, 'C', 'down')).toBe(3)
  })

  it('devolve nulo quando não há vizinho na direção pedida', () => {
    expect(neighborPlacement(backlog, P_A, 'A', 'up')).toBeNull()
    expect(neighborPlacement(backlog, P_A, 'D', 'down')).toBeNull()
  })
})

describe('dropPlacement e resolveInsertIndex', () => {
  it('solta sobre uma tarefa: a posição é a dela na ordem global', () => {
    expect(dropPlacement(backlog, 'D')).toBe(3)
    expect(dropPlacement(backlog, 'desconhecida')).toBeNull()
  })

  it('traduz topo, fim e índice para a posição final', () => {
    expect(resolveInsertIndex('top', 4)).toBe(0)
    expect(resolveInsertIndex('end', 4)).toBe(3)
    expect(resolveInsertIndex(2, 4)).toBe(2)
  })
})

describe('textos de movimento', () => {
  it('anúncio com a posição e o total, como no quadro', () => {
    expect(movedNotice('Integrar webhook', 1, 3)).toBe(
      'Tarefa Integrar webhook movida para a posição 2 de 3',
    )
  })

  it('aviso de desfazer diz se subiu ou desceu', () => {
    expect(movedHeadline('AB-141', 3, 1)).toBe('AB-141 subiu para a posição 2')
    expect(movedHeadline('AB-141', 1, 3)).toBe('AB-141 desceu para a posição 4')
  })

  it('aviso de escopo só existe com outros participantes', () => {
    expect(scopeNoticeFor(0)).toBeNull()
    expect(scopeNoticeFor(1)).toBe('Vale para o time, e o outro participante vê a mudança.')
    expect(scopeNoticeFor(2)).toBe('Vale para o time, e os 2 participantes veem a mudança.')
  })
})

describe('countOtherParticipants', () => {
  const participation = (participant: object) => ({ participant }) as never

  it('não conta quem está logado nem repete a mesma pessoa', () => {
    const participations = [
      participation({ kind: 'user', userId: ME }),
      participation({ kind: 'user', userId: ANA }),
      participation({ kind: 'user', userId: ANA }),
      participation({ kind: 'user', userId: BRUNO }),
      participation({ kind: 'contributor', contributorId: '01J8Y4G2XK8Z1S6M3Q9W0C0001' }),
    ]
    expect(countOtherParticipants(participations, ME)).toBe(3)
  })

  it('sem participações, zero', () => {
    expect(countOtherParticipants([], ME)).toBe(0)
  })
})

describe('formatação', () => {
  it('horas em pt-BR, sem zeros à direita desnecessários', () => {
    expect(formatHours(3)).toBe('3 h')
    expect(formatHours(1.5)).toBe('1,5 h')
    expect(formatHours(0.25)).toBe('0,25 h')
  })

  it('critérios n/m; sem critérios quando o total é zero; traço quando não há resumo', () => {
    expect(criteriaLabel({ done: 1, total: 3 })).toBe('1/3')
    expect(criteriaLabel({ done: 0, total: 0 })).toBe('sem critérios')
    expect(criteriaLabel(undefined)).toBe('—')
  })
})
