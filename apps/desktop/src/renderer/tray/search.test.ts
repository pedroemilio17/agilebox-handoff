import { describe, expect, it } from 'vitest'
import { filterTasks } from './search'

const tasks = [
  { title: 'Revisão do relatório', projectName: 'Aurora', number: 118, key: 'AB-118' },
  { title: 'Publicar versão', projectName: 'Boreal', number: 7, key: 'AB-7' },
]

describe('busca da bandeja', () => {
  it('ignora acentos e maiúsculas e busca em título e projeto', () => {
    expect(filterTasks(tasks, 'REVISAO')).toEqual([tasks[0]])
    expect(filterTasks(tasks, 'boreal')).toEqual([tasks[1]])
  })

  it('encontra tarefa pelo ID ou pelo número', () => {
    expect(filterTasks(tasks, 'AB-118')).toEqual([tasks[0]])
    expect(filterTasks(tasks, 'ab-118')).toEqual([tasks[0]])
    expect(filterTasks(tasks, '7')).toEqual([tasks[1]])
  })

  it('sem texto devolve tudo e sem acerto devolve vazio', () => {
    expect(filterTasks(tasks, '  ')).toHaveLength(2)
    expect(filterTasks(tasks, 'xyz')).toEqual([])
  })
})
