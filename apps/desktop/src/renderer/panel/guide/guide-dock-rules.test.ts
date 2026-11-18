import { describe, expect, it } from 'vitest'
import type { PanelView } from '../layout/PanelShell'
import {
  getGuideCardState,
  guideOnScreen,
  guideStepView,
  initialOpenOnScreen,
} from './guide-card-state'
import { GUIDE_PROJECT_ID, makeGuide } from './guide-fixtures'

const FLOW_SCREENS: readonly PanelView[] = [
  'projects',
  'backlog',
  'sprints',
  'wbs',
  'milestones',
  'schedule',
  'tracking',
  'baseline',
  'burndown',
  'flowMetrics',
  'risks',
  'modules',
]

describe('guideStepView', () => {
  it('diz em que tela cada passo se realiza', () => {
    expect(guideStepView('backlog.rank')).toBe('backlog')
    expect(guideStepView('sprints.add')).toBe('sprints')
    expect(guideStepView('ceremonies.planning')).toBe('agenda')
  })

  it('o passo que acontece na bandeja e as chaves desconhecidas não têm tela', () => {
    expect(guideStepView('daily.answer')).toBeNull()
    expect(guideStepView('qualquer.coisa')).toBeNull()
  })
})

describe('guideOnScreen', () => {
  it('aparece em todas as telas de projeto do fluxo', () => {
    const guide = makeGuide({ doneCount: 1 })
    for (const view of FLOW_SCREENS) expect(guideOnScreen(view, guide)).toBe(true)
  })

  it('não aparece no dashboard, em ajustes, nos plug-ins nem em impedimentos', () => {
    const guide = makeGuide({ doneCount: 1 })
    for (const view of ['dashboard', 'settings', 'plugins', 'impediments'] as const)
      expect(guideOnScreen(view, guide)).toBe(false)
  })

  it('a agenda entra só enquanto um passo pendente se realiza nela', () => {
    // "Marque a planning" é o último passo: pendente até os anteriores ficarem prontos.
    expect(guideOnScreen('agenda', makeGuide({ doneCount: 1 }))).toBe(true)
    expect(guideOnScreen('agenda', makeGuide({ doneCount: 6 }))).toBe(true)
    expect(guideOnScreen('agenda', makeGuide({ doneCount: 7 }))).toBe(false)
  })

  it('sem dados do guia, só as telas fixas valem (o cartão segue sem renderizar)', () => {
    expect(guideOnScreen('agenda', undefined)).toBe(false)
    expect(guideOnScreen('backlog', undefined)).toBe(true)
  })
})

describe('initialOpenOnScreen', () => {
  const stateOf = (options: Parameters<typeof makeGuide>[0]) =>
    getGuideCardState(GUIDE_PROJECT_ID, makeGuide(options))

  it('no quadro segue a intensidade do projeto', () => {
    expect(initialOpenOnScreen(stateOf({ doneCount: 1 }), 'projects')).toBe(true)
    expect(
      initialOpenOnScreen(stateOf({ doneCount: 1, firstStepsCard: 'collapsed' }), 'projects'),
    ).toBe(false)
  })

  it('em outra tela abre só quando o passo atual se realiza nela', () => {
    // Passo atual: "Ordene pela importância" (backlog).
    expect(initialOpenOnScreen(stateOf({ doneCount: 1 }), 'backlog')).toBe(true)
    expect(initialOpenOnScreen(stateOf({ doneCount: 1 }), 'sprints')).toBe(false)
  })

  it('com a trilha concluída, fora do quadro, não abre por padrão', () => {
    expect(initialOpenOnScreen(stateOf({ doneCount: 7 }), 'backlog')).toBe(false)
  })

  it('com o cartão dispensado ou escondido, nunca abre', () => {
    expect(initialOpenOnScreen(stateOf({ doneCount: 1, cardDismissed: true }), 'backlog')).toBe(
      false,
    )
    expect(
      initialOpenOnScreen(stateOf({ doneCount: 1, firstStepsCard: 'hidden' }), 'backlog'),
    ).toBe(false)
  })
})
