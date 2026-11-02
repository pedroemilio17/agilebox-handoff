import { describe, expect, it } from 'vitest'
import { formatTaskCount, formatUpdatedAgo } from './board-status'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const NOW = Date.parse('2026-11-02T12:00:00Z')

describe('Indicador de atualização do quadro', () => {
  it('descreve o tempo desde a última atualização', () => {
    expect(formatUpdatedAgo(NOW, NOW)).toBe('atualizado agora')
    expect(formatUpdatedAgo(NOW - 30_000, NOW)).toBe('atualizado agora')
    expect(formatUpdatedAgo(NOW - 4 * MINUTE, NOW)).toBe('atualizado há 4 min')
    expect(formatUpdatedAgo(NOW - 3 * HOUR, NOW)).toBe('atualizado há 3 h')
    expect(formatUpdatedAgo(NOW - 25 * HOUR, NOW)).toBe('atualizado há 1 dia')
    expect(formatUpdatedAgo(NOW - 49 * HOUR, NOW)).toBe('atualizado há 2 dias')
  })

  it('não mostra tempo negativo quando o relógio está adiantado', () => {
    expect(formatUpdatedAgo(NOW + 5 * MINUTE, NOW)).toBe('atualizado agora')
  })

  it('usa plural em pt-BR na contagem de tarefas', () => {
    expect(formatTaskCount(0)).toBe('0 tarefas')
    expect(formatTaskCount(1)).toBe('1 tarefa')
    expect(formatTaskCount(11)).toBe('11 tarefas')
  })
})
