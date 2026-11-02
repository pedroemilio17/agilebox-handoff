import { describe, expect, it } from 'vitest'
import { parseDateOnly } from '../values/date-only'
import { parseQuickAdd } from './quick-add-parser'
const context = {
  today: parseDateOnly('2026-11-02'),
  people: [
    { id: 'ana', name: 'Ana Souza', initials: 'AS' },
    { id: 'andre', name: 'André Lima', initials: 'AL' },
  ],
  projects: [
    { id: 'app', name: 'AgileBox' },
    { id: 'portal', name: 'Portal Interno' },
  ],
}
describe('interpretador de criação rápida', () => {
  it('separa título e metadados em qualquer ordem, preservando o texto original dos tokens', () => {
    const result = parseQuickAdd('Revisar integração @AS #Portal Interno amanhã', context)
    expect(result).toMatchObject({
      title: 'Revisar integração',
      responsibleId: 'ana',
      projectId: 'portal',
      deadline: '2026-11-03',
      status: 'todo',
    })
    expect(result.tokens.map((token) => token.text)).toEqual(['@AS', '#Portal Interno', 'amanhã'])
    for (const token of result.tokens)
      expect('Revisar integração @AS #Portal Interno amanhã'.slice(token.start, token.end)).toBe(
        token.text,
      )
  })
  it('aceita nome completo, iniciais e prefixo único sem diferenciar acentos e caixa', () => {
    expect(parseQuickAdd('Corrigir @ANDRE LIMA #agile', context)).toMatchObject({
      title: 'Corrigir',
      responsibleId: 'andre',
      projectId: 'app',
    })
    expect(parseQuickAdd('Corrigir @Ana Souza', context).responsibleId).toBe('ana')
    expect(parseQuickAdd('Corrigir @ana', context).responsibleId).toBe('ana')
  })
  it('preserva referências desconhecidas ou ambíguas e não remove texto de email', () => {
    expect(parseQuickAdd('Falar com @a #desconhecido contato@ana.com', context)).toMatchObject({
      title: 'Falar com @a #desconhecido contato@ana.com',
      responsibleId: null,
      projectId: null,
    })
    expect(parseQuickAdd('Revisar @hoje #amanhã', context).deadline).toBeNull()
  })
  it('mantém o mapeamento de posição para Unicode com acentos decompostos', () => {
    const text = 'Revisa\u0303o @Andre\u0301 Lima amanha\u0303'
    const result = parseQuickAdd(text, context)
    expect(result.title).toBe('Revisa\u0303o')
    expect(result.responsibleId).toBe('andre')
    expect(result.deadline).toBe('2026-11-03')
    expect(result.tokens[0]?.text).toBe('@Andre\u0301 Lima')
  })
  it.each([
    ['hoje', '2026-11-02'],
    ['amanhã', '2026-11-03'],
    ['sexta', '2026-11-06'],
    ['sexta-feira', '2026-11-06'],
    ['segunda', '2026-11-02'],
    ['domingo', '2026-11-08'],
    ['terça', '2026-11-03'],
    ['dia 12', '2026-11-12'],
    ['dia 1', '2026-12-01'],
    ['12/11', '2026-11-12'],
    ['1/1', '2027-01-01'],
  ])('interpreta %s a partir de uma data explícita sem relógio global', (text, deadline) => {
    expect(parseQuickAdd(`Revisar ${text}`, context)).toMatchObject({ title: 'Revisar', deadline })
  })
  it('respeita virada de ano, fevereiro bissexto e datas inválidas', () => {
    expect(
      parseQuickAdd('amanhã', { ...context, today: parseDateOnly('2026-12-31') }).deadline,
    ).toBe('2027-01-01')
    expect(
      parseQuickAdd('29/02', { ...context, today: parseDateOnly('2028-02-01') }).deadline,
    ).toBe('2028-02-29')
    for (const text of ['31/02', '32/11', '12/13', 'dia 0', 'dia 32', '12/11/2027'])
      expect(parseQuickAdd(text, context)).toMatchObject({ title: text, deadline: null })
  })
  it('não interpreta prioridade da fase B e não apaga um segundo prazo ou responsável', () => {
    expect(parseQuickAdd('Corrigir !alta hoje amanhã @AS @AL', context)).toMatchObject({
      title: 'Corrigir !alta amanhã @AL',
      responsibleId: 'ana',
      deadline: '2026-11-02',
    })
  })
  it('não interpreta palavras de data dentro de um projeto reconhecido', () => {
    expect(
      parseQuickAdd('Revisar #Entrega Hoje', {
        ...context,
        projects: [{ id: 'today', name: 'Entrega Hoje' }],
      }),
    ).toMatchObject({ title: 'Revisar', projectId: 'today', deadline: null })
    expect(parseQuickAdd('  ', context).title).toBe('')
  })
})
