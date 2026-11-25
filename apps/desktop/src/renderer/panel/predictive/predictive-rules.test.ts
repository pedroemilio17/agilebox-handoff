import { describe, expect, it } from 'vitest'
import {
  budgetUsedText,
  predictiveSubtitle,
  showsPredictiveKpis,
  tasksProgressText,
} from './predictive-rules'

describe('subtítulo de cada tópico do Fluxo Preditivo', () => {
  it('usa o texto do protótipo nos tópicos que a tela tem', () => {
    expect(predictiveSubtitle('wbs')).toBe(
      'Divida o projeto em entregas claras e crie tarefas diretamente dentro de cada grupo.',
    )
    expect(predictiveSubtitle('milestones')).toBe(
      'Acompanhe datas-chave de entrega ou aprovação ao longo do projeto.',
    )
    expect(predictiveSubtitle('baseline')).toBe(
      'Compare a previsão atual com a fotografia original salva no início do projeto.',
    )
  })

  it('o Acompanhamento e as telas fora dos dois grupos não têm subtítulo próprio', () => {
    expect(predictiveSubtitle('tracking')).toBeNull()
    expect(predictiveSubtitle('plan')).toBeNull()
    expect(predictiveSubtitle('projects')).toBeNull()
  })
})

describe('indicadores no topo dos tópicos de cronograma', () => {
  it('aparecem em Cronograma, Marcos e Plano salvo; não no Acompanhamento nem na EAP', () => {
    expect(showsPredictiveKpis('schedule')).toBe(true)
    expect(showsPredictiveKpis('milestones')).toBe(true)
    expect(showsPredictiveKpis('baseline')).toBe(true)
    expect(showsPredictiveKpis('tracking')).toBe(false)
    expect(showsPredictiveKpis('wbs')).toBe(false)
    expect(showsPredictiveKpis('risks')).toBe(false)
  })
})

describe('textos de progresso e orçamento', () => {
  it('conta as tarefas concluídas e trata o projeto sem tarefas', () => {
    expect(tasksProgressText(9, 14)).toBe('9 de 14 tarefas finalizadas')
    expect(tasksProgressText(1, 1)).toBe('1 de 1 tarefa finalizada')
    expect(tasksProgressText(0, 0)).toBe('Nenhuma tarefa ainda')
  })

  it('calcula o percentual do orçamento usado com vírgula decimal', () => {
    expect(budgetUsedText(18420, 22000)).toBe('83,7% do orçamento usado')
  })

  it('não calcula percentual sem orçamento previsto', () => {
    expect(budgetUsedText(18420, null)).toBeNull()
    expect(budgetUsedText(18420, 0)).toBeNull()
  })
})
