import { describe, expect, it } from 'vitest'
import {
  canHaveSubdeliverable,
  dayMonthText,
  overdueDays,
  overdueText,
  collapseToggleLabel,
  collapseAll,
  formatCost,
  formatHours,
  guidedFieldLabel,
  initialsOf,
  isWbsEmpty,
  nextFieldIndex,
  progressTone,
  siblingMove,
  summaryCountText,
  visibleRows,
} from './wbs-screen'
import { deliverableRow, taskRow, wbsId, wbsView } from './wbs-fixtures'

const A = wbsId('1')
const A1 = wbsId('2')
const A1A = wbsId('3')
const B = wbsId('4')
const T1 = wbsId('5')

/** Árvore: A > A1 > A1A; A tem a tarefa T1; B é irmã de A. */
function sampleRows() {
  return [
    deliverableRow(A, { code: '1', title: 'Levantamento' }),
    deliverableRow(A1, { parentId: A, code: '1.1', level: 2, title: 'Entrevistas' }),
    deliverableRow(A1A, { parentId: A1, code: '1.1.1', level: 3, title: 'Mapa' }),
    taskRow(T1, A, { title: 'Agendar entrevistas' }),
    deliverableRow(B, { code: '2', title: 'Configuração' }),
  ]
}

describe('visibleRows', () => {
  it('mostra tudo quando nada está recolhido', () => {
    expect(visibleRows(sampleRows(), new Set())).toHaveLength(5)
  })

  it('esconde os filhos de uma entrega recolhida, em qualquer profundidade', () => {
    const ids = visibleRows(sampleRows(), new Set([A])).map((row) =>
      row.kind === 'deliverable' ? row.id : row.taskId,
    )
    expect(ids).toEqual([A, B])
  })

  it('recolher um nível intermediário esconde só o que está abaixo dele', () => {
    const ids = visibleRows(sampleRows(), new Set([A1])).map((row) =>
      row.kind === 'deliverable' ? row.id : row.taskId,
    )
    expect(ids).toEqual([A, A1, T1, B])
  })
})

describe('collapseAll', () => {
  it('recolhe só as entregas que têm filhos', () => {
    expect([...collapseAll(sampleRows())].sort()).toEqual([A, A1].sort())
  })
})

describe('canHaveSubdeliverable', () => {
  it('permite subentrega até o nível 2 e esconde no nível 3', () => {
    expect(canHaveSubdeliverable(1)).toBe(true)
    expect(canHaveSubdeliverable(2)).toBe(true)
    expect(canHaveSubdeliverable(3)).toBe(false)
  })
})

describe('formatação de horas e custo', () => {
  it('mostra horas inteiras e decimais no padrão brasileiro', () => {
    expect(formatHours(40)).toBe('40 h')
    expect(formatHours(12.5)).toBe('12,5 h')
    expect(formatHours(null)).toBe('—')
  })

  it('mostra o custo em reais e traço quando não é visível', () => {
    expect(formatCost(1800)).toBe('R$ 1.800,00')
    expect(formatCost(12.5)).toBe('R$ 12,50')
    expect(formatCost(null)).toBe('—')
  })
})

describe('progresso e resumo', () => {
  it('100% é concluído, acima de zero é em andamento, zero é parado', () => {
    expect(progressTone(100)).toBe('done')
    expect(progressTone(40)).toBe('started')
    expect(progressTone(0)).toBe('idle')
  })

  it('conta entregas e tarefas com plural correto', () => {
    expect(summaryCountText(4, 10)).toBe('4 · 10 tarefas')
    expect(summaryCountText(1, 1)).toBe('1 · 1 tarefa')
    expect(summaryCountText(0, 0)).toBe('0 · 0 tarefas')
  })

  it('gera iniciais do responsável', () => {
    expect(initialsOf('Ana Souza Lima')).toBe('AL')
    expect(initialsOf('Pedro')).toBe('P')
    expect(initialsOf(null)).toBe('—')
  })
})

describe('siblingMove', () => {
  const rows = [
    deliverableRow(A, { code: '1' }),
    deliverableRow(B, { code: '2' }),
    deliverableRow(wbsId('6'), { code: '3' }),
    deliverableRow(A1, { parentId: A, code: '1.1', level: 2 }),
    deliverableRow(A1A, { parentId: A, code: '1.2', level: 2 }),
  ]

  it('sobe para a posição anterior entre os irmãos', () => {
    expect(siblingMove(rows, B, 'up')).toEqual({ parentId: null, position: 0 })
  })

  it('desce para a posição seguinte entre os irmãos', () => {
    expect(siblingMove(rows, A, 'down')).toEqual({ parentId: null, position: 1 })
  })

  it('nas pontas não há movimento', () => {
    expect(siblingMove(rows, A, 'up')).toBeNull()
    expect(siblingMove(rows, wbsId('6'), 'down')).toBeNull()
  })

  it('move dentro das subentregas do mesmo pai, sem sair dele', () => {
    expect(siblingMove(rows, A1A, 'up')).toEqual({ parentId: A, position: 0 })
    expect(siblingMove(rows, A1, 'down')).toEqual({ parentId: A, position: 1 })
  })
})

describe('estado vazio', () => {
  it('é vazio quando não há nenhuma entrega', () => {
    expect(isWbsEmpty(wbsView([]))).toBe(true)
    expect(isWbsEmpty(wbsView([taskRow(T1, A)]))).toBe(true)
    expect(isWbsEmpty(wbsView([deliverableRow(A)]))).toBe(false)
  })

  it('numera os campos pela posição: Entrega 1, Entrega 2', () => {
    expect(guidedFieldLabel(0)).toBe('Entrega 1')
    expect(guidedFieldLabel(1)).toBe('Entrega 2')
  })

  it('avança para o próximo campo e para no último', () => {
    expect(nextFieldIndex(0, 2)).toBe(1)
    expect(nextFieldIndex(1, 2)).toBeNull()
  })
})

describe('collapseToggleLabel', () => {
  it('oferece recolher quando há algo aberto e expandir quando tudo está recolhido', () => {
    const rows = sampleRows()
    expect(collapseToggleLabel(rows, new Set())).toBe('Recolher tudo')
    expect(collapseToggleLabel(rows, new Set([A]))).toBe('Recolher tudo')
    expect(collapseToggleLabel(rows, collapseAll(rows))).toBe('Expandir tudo')
  })
})

describe('atraso e datas curtas da EAP', () => {
  it('conta os dias de atraso só de tarefa sem concluir com prazo antes de hoje', () => {
    expect(overdueDays('2026-11-11', false, '2026-11-18')).toBe(7)
    expect(overdueDays('2026-11-17', false, '2026-11-18')).toBe(1)
    expect(overdueDays('2026-11-18', false, '2026-11-18')).toBeNull()
    expect(overdueDays('2026-11-11', true, '2026-11-18')).toBeNull()
    expect(overdueDays(null, false, '2026-11-18')).toBeNull()
  })

  it('escreve o aviso no singular e no plural', () => {
    expect(overdueText(1)).toBe('1 dia atrás')
    expect(overdueText(7)).toBe('7 dias atrás')
  })

  it('mostra dia e mês da data', () => {
    expect(dayMonthText('2026-12-18')).toBe('18/12')
  })
})
