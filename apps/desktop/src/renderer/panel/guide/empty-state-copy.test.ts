import { describe, expect, it } from 'vitest'
import { getManifest } from '@agilebox/core'
import { emptyStateCopy } from './empty-state-copy'

const FALLBACK = { title: 'Texto antigo', description: 'Descrição antiga' }
const backlog = getManifest('backlog')

describe('emptyStateCopy', () => {
  it('com intensidade full usa a frase curta e a explicação com exemplo', () => {
    expect(emptyStateCopy(backlog, 'full', FALLBACK)).toEqual({
      title: backlog.emptyState.short,
      description: backlog.emptyState.full,
    })
  })

  it('com intensidade short usa só a frase, sem descrição', () => {
    expect(emptyStateCopy(backlog, 'short', FALLBACK)).toEqual({
      title: backlog.emptyState.short,
      description: undefined,
    })
  })

  it('sem intensidade (guia carregando, com erro ou sem projeto) usa o fallback', () => {
    expect(emptyStateCopy(backlog, undefined, FALLBACK)).toEqual(FALLBACK)
  })

  it('sem manifesto usa o fallback, mesmo com intensidade', () => {
    expect(emptyStateCopy(null, 'full', FALLBACK)).toEqual(FALLBACK)
  })

  it('fallback sem descrição devolve descrição indefinida', () => {
    expect(emptyStateCopy(null, undefined, { title: 'Só título' })).toEqual({
      title: 'Só título',
      description: undefined,
    })
  })
})
