import { describe, expect, it } from 'vitest'
import { NotFoundError, ValidationError } from '../shared/errors'
import {
  ACCEPTANCE_TEXT_MAX_LENGTH,
  acceptanceSummary,
  addCriterion,
  editCriterionText,
  parseAcceptanceText,
  removeCriterion,
  reorderCriterion,
  setCriterionDone,
  toAcceptanceCriterionId,
} from './acceptance-criteria'
import type { AcceptanceCriterion, AcceptanceCriterionId } from './acceptance-criteria'

const id = (n: number) => toAcceptanceCriterionId(String(n).padStart(26, '0'))
const add = (criteria: AcceptanceCriterion[], n: number, text = `Critério ${n}`) =>
  addCriterion(criteria, { id: id(n), text })
const texts = (criteria: readonly AcceptanceCriterion[]) => criteria.map((c) => c.text)
const ids = (criteria: readonly AcceptanceCriterion[]) => criteria.map((c) => c.id)

function threeCriteria(): AcceptanceCriterion[] {
  return [id(1), id(2), id(3)].reduce<AcceptanceCriterion[]>(
    (list, criterionId, index) =>
      addCriterion(list, { id: criterionId, text: `Item ${index + 1}` }),
    [],
  )
}

describe('identificador do critério', () => {
  it('aceita só o formato de identificador do sistema', () => {
    expect(toAcceptanceCriterionId('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    for (const invalid of [
      '',
      'curto',
      'x'.repeat(27),
      '8'.repeat(26),
      '01ARZ3NDEKTSV4RRFFQ69G5FA!',
    ]) {
      expect(() => toAcceptanceCriterionId(invalid)).toThrow(ValidationError)
    }
  })
})

describe('texto do critério', () => {
  it('recusa vazio, só espaços e tipo errado', () => {
    for (const invalid of ['', '   ', '\n\t', undefined, null, 42]) {
      expect(() => parseAcceptanceText(invalid as unknown as string)).toThrow(ValidationError)
    }
  })

  it('recusa texto só com caracteres invisíveis, controles e quebras de linha', () => {
    for (const invisible of [
      '\u200B',
      '\uFEFF',
      '\u200B\u200B \uFEFF',
      '\u0000',
      '\u0007\u001F',
      '\n\n',
      '\r\n\t',
      '\u00AD\u2060\u200D',
      ' \u200B\n\uFEFF ',
    ]) {
      expect(() => parseAcceptanceText(invisible), JSON.stringify(invisible)).toThrow(
        ValidationError,
      )
    }
  })

  it('devolve o texto sem espaços nas pontas', () => {
    expect(parseAcceptanceText('  Login funciona  ')).toBe('Login funciona')
  })

  it('aceita até o limite e recusa um caractere a mais', () => {
    const atLimit = 'a'.repeat(ACCEPTANCE_TEXT_MAX_LENGTH)
    expect(parseAcceptanceText(atLimit)).toBe(atLimit)
    expect(() => parseAcceptanceText(`${atLimit}a`)).toThrow(ValidationError)
  })

  it('conta pontos de código, não unidades UTF-16 (emoji conta como um)', () => {
    const emoji = '😀'.repeat(ACCEPTANCE_TEXT_MAX_LENGTH)
    expect(parseAcceptanceText(emoji)).toBe(emoji)
    expect(() => parseAcceptanceText(`${emoji}😀`)).toThrow(ValidationError)
  })

  it('aceita acentos, caracteres especiais e SQL sem alterar', () => {
    const text = "Validação: 'ação' || 1=1; -- DROP TABLE tasks"
    expect(parseAcceptanceText(text)).toBe(text)
  })
})

describe('adicionar critério', () => {
  it('acrescenta no fim, não conferido, sem mutar a lista original', () => {
    const original = [] as AcceptanceCriterion[]
    const next = addCriterion(original, { id: id(1), text: 'Tela abre' })
    expect(next).toEqual([{ id: id(1), text: 'Tela abre', done: false }])
    expect(original).toEqual([])
    expect(texts(add(next, 2, 'Segundo'))).toEqual(['Tela abre', 'Segundo'])
  })

  it('recusa identificador repetido na mesma lista', () => {
    const list = add([], 1)
    expect(() => addCriterion(list, { id: id(1), text: 'Outro' })).toThrow(ValidationError)
  })

  it('recusa texto inválido e identificador inválido', () => {
    expect(() => addCriterion([], { id: id(1), text: '  ' })).toThrow(ValidationError)
    expect(() => addCriterion([], { id: 'nope', text: 'Ok' })).toThrow(ValidationError)
  })

  it('não cria critério quando a entrada é recusada', () => {
    const list = add([], 1)
    expect(() => addCriterion(list, { id: id(2), text: '' })).toThrow(ValidationError)
    expect(list).toHaveLength(1)
  })
})

describe('editar texto', () => {
  it('troca o texto e mantém a situação e a posição', () => {
    const list = setCriterionDone(threeCriteria(), id(2), true)
    const next = editCriterionText(list, id(2), '  Novo texto ')
    expect(next[1]).toEqual({ id: id(2), text: 'Novo texto', done: true })
    expect(ids(next)).toEqual(ids(list))
  })

  it('recusa texto vazio e mantém o original', () => {
    const list = threeCriteria()
    expect(() => editCriterionText(list, id(1), '   ')).toThrow(ValidationError)
    expect(texts(list)[0]).toBe('Item 1')
  })

  it('recusa identificador que não existe', () => {
    expect(() => editCriterionText(threeCriteria(), id(9), 'X')).toThrow(NotFoundError)
  })
})

describe('marcar feito ou não feito', () => {
  it('marca e desmarca só o critério indicado', () => {
    const marked = setCriterionDone(threeCriteria(), id(2), true)
    expect(marked.map((c) => c.done)).toEqual([false, true, false])
    const unmarked = setCriterionDone(marked, id(2), false)
    expect(unmarked.map((c) => c.done)).toEqual([false, false, false])
  })

  it('é idempotente: marcar de novo não muda o resultado', () => {
    const once = setCriterionDone(threeCriteria(), id(1), true)
    expect(setCriterionDone(once, id(1), true)).toEqual(once)
  })

  it('não muda a lista original', () => {
    const list = threeCriteria()
    setCriterionDone(list, id(1), true)
    expect(list.every((c) => !c.done)).toBe(true)
  })

  it('recusa situação que não é booleana e identificador inexistente', () => {
    expect(() => setCriterionDone(threeCriteria(), id(1), 'sim' as unknown as boolean)).toThrow(
      ValidationError,
    )
    expect(() => setCriterionDone(threeCriteria(), id(9), true)).toThrow(NotFoundError)
  })
})

describe('remover critério', () => {
  it('remove o indicado e mantém a ordem dos demais', () => {
    expect(texts(removeCriterion(threeCriteria(), id(2)))).toEqual(['Item 1', 'Item 3'])
  })

  it('remover o último deixa lista vazia; identificador inexistente é recusado', () => {
    expect(removeCriterion(add([], 1), id(1))).toEqual([])
    expect(() => removeCriterion(threeCriteria(), id(9))).toThrow(NotFoundError)
  })
})

describe('reordenar critérios', () => {
  it('move para o topo, para o fim e para o meio, com a ordem relativa preservada', () => {
    expect(texts(reorderCriterion(threeCriteria(), id(3), 0))).toEqual([
      'Item 3',
      'Item 1',
      'Item 2',
    ])
    expect(texts(reorderCriterion(threeCriteria(), id(1), 2))).toEqual([
      'Item 2',
      'Item 3',
      'Item 1',
    ])
    expect(texts(reorderCriterion(threeCriteria(), id(1), 1))).toEqual([
      'Item 2',
      'Item 1',
      'Item 3',
    ])
  })

  it('mover para a própria posição devolve a mesma ordem', () => {
    expect(ids(reorderCriterion(threeCriteria(), id(2), 1))).toEqual([id(1), id(2), id(3)])
  })

  it('leva a situação junto com o critério', () => {
    const list = setCriterionDone(threeCriteria(), id(1), true)
    const next = reorderCriterion(list, id(1), 2)
    expect(next[2]).toEqual({ id: id(1), text: 'Item 1', done: true })
  })

  it('recusa posição fora de 0..n-1, não inteira ou inexistente', () => {
    const list = threeCriteria()
    for (const toIndex of [-1, 3, 1.5, Number.NaN]) {
      expect(() => reorderCriterion(list, id(1), toIndex)).toThrow(ValidationError)
    }
    expect(() => reorderCriterion(list, id(9), 0)).toThrow(NotFoundError)
  })

  it('lista com um item aceita só a posição 0', () => {
    const single = add([], 1)
    expect(ids(reorderCriterion(single, id(1), 0))).toEqual([id(1)])
    expect(() => reorderCriterion(single, id(1), 1)).toThrow(ValidationError)
  })
})

describe('lista com identificador repetido', () => {
  const duplicated = (): AcceptanceCriterion[] => [
    { id: id(1), text: 'Primeiro', done: false },
    { id: id(1), text: 'Repetido', done: false },
  ]

  it('editar, marcar, remover e reordenar recusam a lista inteira', () => {
    expect(() => editCriterionText(duplicated(), id(1), 'Novo')).toThrow(ValidationError)
    expect(() => setCriterionDone(duplicated(), id(1), true)).toThrow(ValidationError)
    expect(() => removeCriterion(duplicated(), id(1))).toThrow(ValidationError)
    expect(() => reorderCriterion(duplicated(), id(1), 0)).toThrow(ValidationError)
  })
})

describe('contagem n/m', () => {
  it('lista vazia: 0/0 e não está tudo conferido', () => {
    expect(acceptanceSummary([])).toEqual({ done: 0, total: 0, allDone: false })
  })

  it('conta feitos e total; allDone só quando todos estão feitos', () => {
    const partial = setCriterionDone(threeCriteria(), id(1), true)
    expect(acceptanceSummary(partial)).toEqual({ done: 1, total: 3, allDone: false })
    const all = [id(1), id(2), id(3)].reduce(
      (list, criterionId) => setCriterionDone(list, criterionId, true),
      threeCriteria(),
    )
    expect(acceptanceSummary(all)).toEqual({ done: 3, total: 3, allDone: true })
  })

  it('remover um feito atualiza a contagem', () => {
    const list = setCriterionDone(threeCriteria(), id(1), true)
    expect(acceptanceSummary(removeCriterion(list, id(1)))).toEqual({
      done: 0,
      total: 2,
      allDone: false,
    })
  })

  it('aguenta lista grande (10 mil itens) sem erro', () => {
    const big = Array.from({ length: 10_000 }, (_, i) => ({
      id: `${String(i).padStart(26, '0')}` as AcceptanceCriterionId,
      text: `Item ${i}`,
      done: i % 2 === 0,
    }))
    expect(acceptanceSummary(big)).toEqual({ done: 5000, total: 10_000, allDone: false })
  })
})
