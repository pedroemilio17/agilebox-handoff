import { describe, expect, it } from 'vitest'
import type { WizardDraft } from './wizard-steps'
import {
  nextStep,
  previousStep,
  progressPercent,
  railSteps,
  remainingLabel,
  remainingSteps,
  stepOrder,
  toWizardAnswers,
  totalSteps,
  visibleSteps,
  withAnswer,
  questionPosition,
} from './wizard-steps'

const FINITE: WizardDraft = { workType: 'finite', fixedDate: 'yes', scope: 'defined' }
const CONTINUOUS: WizardDraft = { workType: 'continuous' }

describe('perguntas visíveis', () => {
  it('mostra as cinco perguntas, na ordem do ADR-10, quando o trabalho tem fim', () => {
    expect(visibleSteps({}).map((question) => question.id)).toEqual([
      'workType',
      'fixedDate',
      'scope',
      'outsiderFollows',
      'controlsHoursAndCost',
    ])
  })

  it('pula data final e escopo quando o trabalho é contínuo', () => {
    expect(visibleSteps(CONTINUOUS).map((question) => question.id)).toEqual([
      'workType',
      'outsiderFollows',
      'controlsHoursAndCost',
    ])
  })

  it('usa o texto e as opções do ADR-10', () => {
    const [workType, fixedDate, scope, outsider, controls] = visibleSteps({})
    expect(workType?.question).toBe(
      'Esse trabalho tem começo e fim, ou é contínuo, com pedidos chegando sempre?',
    )
    expect(workType?.options.map((option) => option.label)).toEqual([
      'Tem fim',
      'Contínuo',
      'Não sei',
    ])
    expect(fixedDate?.question).toBe('Existe uma data final que não pode mudar?')
    expect(fixedDate?.options.map((option) => option.label)).toEqual(['Sim', 'Não', 'Não sei'])
    expect(scope?.question).toBe('O que vai ser entregue já está definido?')
    expect(scope?.options.map((option) => option.label)).toEqual([
      'Sim, está tudo definido',
      'Em parte',
      'Vai mudar no caminho',
      'Não sei',
    ])
    expect(outsider?.question).toBe('Alguém de fora acompanha por entregas e datas?')
    expect(controls?.question).toBe('Vocês precisam controlar horas e custo?')
  })
})

describe('contagem e progresso', () => {
  it('conta a recomendação no total: seis no caminho com fim, quatro no contínuo', () => {
    expect(totalSteps({})).toBe(6)
    expect(totalSteps(CONTINUOUS)).toBe(4)
  })

  it('numera a pergunta pela posição no fluxo visível', () => {
    expect(questionPosition(FINITE, 'scope')).toBe(3)
    expect(questionPosition(CONTINUOUS, 'outsiderFollows')).toBe(2)
    expect(questionPosition(CONTINUOUS, 'scope')).toBe(0)
  })

  it('calcula as perguntas que faltam, contando a recomendação', () => {
    expect(remainingSteps(FINITE, 'scope')).toBe(3)
    expect(remainingSteps(CONTINUOUS, 'controlsHoursAndCost')).toBe(1)
    expect(remainingLabel(1)).toBe('Falta 1 pergunta')
    expect(remainingLabel(3)).toBe('Faltam 3 perguntas')
  })

  it('mostra progresso de 0 a 100 e fica no meio do passo atual', () => {
    expect(progressPercent({}, 'name')).toBe(0)
    expect(progressPercent(FINITE, 'scope')).toBe(42)
    expect(progressPercent(CONTINUOUS, 'outsiderFollows')).toBe(38)
    expect(progressPercent(FINITE, 'recommendation')).toBe(100)
    for (const step of stepOrder({})) {
      const value = progressPercent({}, step)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})

describe('avançar e voltar', () => {
  it('vai do nome à primeira pergunta e da última para a recomendação', () => {
    expect(nextStep({}, 'name')).toBe('workType')
    expect(nextStep(FINITE, 'controlsHoursAndCost')).toBe('recommendation')
  })

  it('pula data e escopo ao avançar num trabalho contínuo', () => {
    expect(nextStep(CONTINUOUS, 'workType')).toBe('outsiderFollows')
    expect(nextStep(CONTINUOUS, 'outsiderFollows')).toBe('controlsHoursAndCost')
  })

  it('volta pela mesma ordem e pula as perguntas ocultas', () => {
    expect(previousStep(CONTINUOUS, 'outsiderFollows')).toBe('workType')
    expect(previousStep(FINITE, 'scope')).toBe('fixedDate')
    expect(previousStep(FINITE, 'workType')).toBe('name')
    expect(previousStep(FINITE, 'name')).toBe('name')
    expect(stepOrder(CONTINUOUS)).toEqual([
      'name',
      'workType',
      'outsiderFollows',
      'controlsHoursAndCost',
      'recommendation',
    ])
  })
})

describe('respostas', () => {
  it('registra uma opção e recusa valor que não é opção da pergunta', () => {
    expect(withAnswer({}, 'scope', 'partly')).toEqual({ scope: 'partly' })
    expect(() => withAnswer({}, 'scope', 'yes')).toThrow()
  })

  it('converte para WizardAnswers sem "Não sei" de sim/não e sem perguntas puladas', () => {
    expect(
      toWizardAnswers({
        workType: 'finite',
        fixedDate: 'unknown',
        scope: 'will_change',
        outsiderFollows: 'unknown',
        controlsHoursAndCost: 'no',
      }),
    ).toEqual({
      workType: 'finite',
      fixedDate: 'unknown',
      scope: 'will_change',
      controlsHoursAndCost: 'no',
    })
    expect(toWizardAnswers({ workType: 'continuous', fixedDate: 'yes', scope: 'defined' })).toEqual(
      { workType: 'continuous' },
    )
  })

  it('o trilho mostra o resumo das respostas, "Não se aplica" e "Não sei" de etapas passadas', () => {
    const rows = railSteps(
      { workType: 'continuous', outsiderFollows: 'yes' },
      'controlsHoursAndCost',
      'App de Chamados',
    )
    expect(rows.map((row) => [row.label, row.answer])).toEqual([
      ['Nome', 'App de Chamados'],
      ['Tipo de trabalho', 'Contínuo, sem fim'],
      ['Data final', 'Não se aplica'],
      ['Entrega', 'Não se aplica'],
      ['Quem acompanha', 'Sim'],
      ['Horas e custo', ''],
      ['Recomendação', ''],
    ])
    const current = rows.find((row) => row.state === 'current')
    expect(current?.label).toBe('Horas e custo')
    expect(
      railSteps({ workType: 'finite' }, 'scope', 'App').find((row) => row.label === 'Data final')
        ?.answer,
    ).toBe('Não sei')
  })
})
