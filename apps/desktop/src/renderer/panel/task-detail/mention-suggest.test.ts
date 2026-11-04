import { describe, expect, it } from 'vitest'
import {
  filterMentionOptions,
  findMentionQuery,
  insertMention,
  type MentionOption,
} from './mention-suggest'

const OPTIONS: MentionOption[] = [
  { id: '1', name: 'Ana Souza' },
  { id: '2', name: 'Bruno Lima' },
]

describe('findMentionQuery', () => {
  it('reconhece @ no início ou depois de espaço', () => {
    expect(findMentionQuery('@an', 3)).toEqual({ start: 0, query: 'an' })
    expect(findMentionQuery('oi @', 4)).toEqual({ start: 3, query: '' })
  })

  it('ignora @ colado em palavra, e-mails e quebras de linha', () => {
    expect(findMentionQuery('pedro@ana', 9)).toBeNull()
    expect(findMentionQuery('@ana\nouvi', 9)).toBeNull()
    expect(findMentionQuery('sem arroba', 5)).toBeNull()
  })

  it('usa só o trecho até o cursor', () => {
    expect(findMentionQuery('@ana depois', 4)).toEqual({ start: 0, query: 'ana' })
  })
})

describe('filterMentionOptions', () => {
  it('filtra por parte do nome, sem diferenciar maiúsculas', () => {
    expect(filterMentionOptions(OPTIONS, 'SOU').map((option) => option.id)).toEqual(['1'])
    expect(filterMentionOptions(OPTIONS, '').map((option) => option.id)).toEqual(['1', '2'])
  })
})

describe('insertMention', () => {
  it('troca o @ digitado pelo nome completo e posiciona o cursor depois', () => {
    const result = insertMention('oi @an', { start: 3, query: 'an' }, 6, 'Ana Souza')
    expect(result).toEqual({ text: 'oi @Ana Souza ', caret: 14 })
  })
})
