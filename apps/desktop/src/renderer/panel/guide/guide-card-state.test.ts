import { describe, expect, it } from 'vitest'
import { getGuideCardState, guideStepAction } from './guide-card-state'
import { guideCopy } from './guide-copy'
import { GUIDE_PROJECT_ID, makeGuide } from './guide-fixtures'

describe('getGuideCardState', () => {
  it('abre quando a intensidade pede open e recolhe quando pede collapsed', () => {
    expect(getGuideCardState(GUIDE_PROJECT_ID, makeGuide()).initiallyOpen).toBe(true)
    const collapsed = makeGuide({ firstStepsCard: 'collapsed' })
    const state = getGuideCardState(GUIDE_PROJECT_ID, collapsed)
    expect(state.visible).toBe(true)
    expect(state.initiallyOpen).toBe(false)
  })

  it('não aparece sem projeto, sem dados, sem trilha, dispensado ou escondido', () => {
    expect(getGuideCardState(null, makeGuide()).visible).toBe(false)
    expect(getGuideCardState(GUIDE_PROJECT_ID, undefined).visible).toBe(false)
    expect(getGuideCardState(GUIDE_PROJECT_ID, { ...makeGuide(), trail: [] }).visible).toBe(false)
    expect(getGuideCardState(GUIDE_PROJECT_ID, makeGuide({ cardDismissed: true })).visible).toBe(
      false,
    )
    expect(
      getGuideCardState(GUIDE_PROJECT_ID, makeGuide({ firstStepsCard: 'hidden' })).visible,
    ).toBe(false)
  })

  it('ignora dados de outro projeto', () => {
    const other = makeGuide({ projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCD2' })
    expect(getGuideCardState(GUIDE_PROJECT_ID, other).visible).toBe(false)
  })

  it('calcula o contador, o percentual e o passo atual', () => {
    const state = getGuideCardState(GUIDE_PROJECT_ID, makeGuide({ doneCount: 1 }))
    expect(state.progressText).toBe('1 de 7')
    expect(state.done).toBe(1)
    expect(state.total).toBe(7)
    expect(state.percent).toBe(14)
    expect(state.current?.step.key).toBe('backlog.rank')
    expect(state.complete).toBe(false)
    expect(state.steps.map((item) => item.status)).toEqual([
      'done',
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ])
    expect(state.nextTitle).toBe('Crie a primeira sprint')
  })

  it('marca "Último passo" como próximo quando o atual é o último', () => {
    const state = getGuideCardState(GUIDE_PROJECT_ID, makeGuide({ doneCount: 6 }))
    expect(state.current?.step.key).toBe('ceremonies.planning')
    expect(state.nextTitle).toBeNull()
  })

  it('com a trilha toda feita, continua visível como concluída', () => {
    const state = getGuideCardState(GUIDE_PROJECT_ID, makeGuide({ doneCount: 7 }))
    expect(state.visible).toBe(true)
    expect(state.complete).toBe(true)
    expect(state.current).toBeNull()
    expect(state.action).toBeNull()
    expect(state.progressText).toBe('7 de 7')
    expect(state.percent).toBe(100)
  })
})

describe('guideStepAction', () => {
  it('leva o backlog, as sprints e a agenda para as telas certas', () => {
    expect(guideStepAction('backlog.list')).toEqual({
      kind: 'navigate',
      view: 'backlog',
      label: 'Abrir o backlog',
    })
    expect(guideStepAction('backlog.rank')).toEqual({
      kind: 'navigate',
      view: 'backlog',
      label: 'Abrir o backlog',
    })
    expect(guideStepAction('estimate.first')).toEqual({
      kind: 'navigate',
      view: 'backlog',
      label: 'Abrir o backlog',
    })
    expect(guideStepAction('sprints.create')).toEqual({
      kind: 'navigate',
      view: 'sprints',
      label: 'Abrir sprints',
    })
    expect(guideStepAction('sprints.add')).toEqual({
      kind: 'navigate',
      view: 'sprints',
      label: 'Abrir sprints',
    })
    expect(guideStepAction('ceremonies.planning')).toEqual({
      kind: 'navigate',
      view: 'agenda',
      label: 'Abrir a agenda',
    })
  })

  it('o passo diário não tem botão, só orientação', () => {
    expect(guideStepAction('daily.answer')).toEqual({
      kind: 'note',
      text: guideCopy.dailyNote,
    })
    expect(guideCopy.dailyNote).toBe('Pela bandeja, no fim do dia')
  })

  it('chave desconhecida não tem ação', () => {
    expect(guideStepAction('qualquer.coisa')).toBeNull()
  })
})

describe('ação do passo da EAP', () => {
  it('"Liste as entregas" e "Quebre cada entrega" levam à tela Entregas', () => {
    expect(guideStepAction('wbs.deliverables')).toEqual({
      kind: 'navigate',
      view: 'wbs',
      label: 'Abrir as entregas',
    })
    expect(guideStepAction('wbs.tasks')).toEqual({
      kind: 'navigate',
      view: 'wbs',
      label: 'Abrir as entregas',
    })
  })

  it('marcos ainda não têm botão', () => {
    expect(guideStepAction('milestones.create')).toBeNull()
  })
})
