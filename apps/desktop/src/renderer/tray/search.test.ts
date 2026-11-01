import { describe, expect, it } from 'vitest'
import { filterTasks } from './search'

const tasks = [
  { title: 'Revisão do relatório', projectName: 'Aurora' },
  { title: 'Publicar versão', projectName: 'Boreal' },
]

describe('busca da bandeja', () => {
  it('ignora acentos e maiúsculas e busca em título e projeto', () => {
    expect(filterTasks(tasks, 'REVISAO')).toEqual([tasks[0]])
    expect(filterTasks(tasks, 'boreal')).toEqual([tasks[1]])
  })

  it('sem texto devolve tudo e sem acerto devolve vazio', () => {
    expect(filterTasks(tasks, '  ')).toHaveLength(2)
    expect(filterTasks(tasks, 'xyz')).toEqual([])
  })
})
