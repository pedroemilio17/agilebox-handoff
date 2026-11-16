import { describe, expect, it } from 'vitest'
import { MODULE_LABELS } from '@agilebox/core'
import { forbiddenTermsIn, SCRUM_AND_FLOW_MODULES, visibleTextOf } from './forbidden-terms'

describe('Termos proibidos no Kanban simples', () => {
  it('cobre o nome de cada ferramenta de Scrum e fluxo do catálogo', () => {
    // Se um módulo novo entrar no catálogo como ferramenta de Scrum, este teste manda incluí-lo aqui.
    for (const id of SCRUM_AND_FLOW_MODULES) {
      const label = MODULE_LABELS[id]
      expect(forbiddenTermsIn(label), `nome de ${id}: ${label}`).not.toEqual([])
    }
  })

  it('pega os textos de Scrum e de fluxo, com plural e sem diferenciar maiúsculas', () => {
    const cases = [
      'Sprint 4',
      'Tarefas de Sprints',
      'Backlog de projeto',
      'Estimativa em horas',
      'Desbloquear',
      'Bloquear',
      'Limite de WIP',
      'Desenvolvendo: 1 de 3',
      'tempo de ciclo médio',
      'Ciclo médio desta semana',
      'Vamos registrar o que foi feito hoje?',
      'Adicionar combinado',
      'Burndown e velocity',
      'Check-ins',
    ]
    for (const text of cases) {
      expect(forbiddenTermsIn(text), text).not.toEqual([])
    }
  })

  it('não pega palavras comuns nem as que parecem com os termos', () => {
    const safe = [
      'Publicar versão',
      'Revisar integração',
      'Concluído',
      'Desarquivar',
      'Agenda',
      'wiping',
      'Limite de 20 itens.',
      'Próximos agendamentos',
    ]
    for (const text of safe) {
      expect(forbiddenTermsIn(text), text).toEqual([])
    }
  })

  it('varre o texto visível: textos, aria-label e placeholder, e pula a parte indicada', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <p>Quadro</p>
      <button aria-label="Bloqueadas · 1">x</button>
      <input placeholder="Adicionar subtarefa" />
      <section id="skip"><p>Sprint 1</p></section>
    `
    const all = forbiddenTermsIn(visibleTextOf(root))
    expect(all.some((term) => term.includes('Sprint'))).toBe(true)
    expect(all.some((term) => term.includes('Bloqueadas'))).toBe(true)
    expect(all.some((term) => term.includes('Subtarefa'))).toBe(true)

    const skipped = forbiddenTermsIn(visibleTextOf(root, root.querySelector('#skip') as Element))
    expect(skipped.some((term) => term.includes('Sprint'))).toBe(false)
    expect(skipped.some((term) => term.includes('Bloqueadas'))).toBe(true)
  })
})
