import { describe, expect, it } from 'vitest'
import type { ModuleId } from '@agilebox/core'
import { projectModulesView } from '../../shared/testing/project-modules-fixture'
import {
  buildModuleGroups,
  dependencyText,
  effectsOf,
  enabledIdsOf,
  LISTED_MODULE_IDS,
  linkedOf,
  previewToggle,
  scheduledText,
  startedFromText,
  summarizeModules,
} from './modules-screen'

const ALL = projectModulesView().modules

describe('buildModuleGroups', () => {
  it('mantém os quatro grupos fixos, na ordem do design', () => {
    const groups = buildModuleGroups(ALL)
    expect(groups.map((group) => group.title)).toEqual([
      'Escopo e qualidade',
      'Planejamento',
      'Acompanhamento',
      'Outros',
    ])
  })

  it('põe cada módulo no grupo certo, sem núcleo e sem Plug-ins', () => {
    const groups = buildModuleGroups(ALL)
    const idsOf = (title: string) =>
      groups.find((group) => group.title === title)?.rows.map((row) => row.id)
    expect(idsOf('Escopo e qualidade')).toEqual(['backlog', 'wbs', 'definitionOfDone', 'risks'])
    expect(idsOf('Planejamento')).toEqual([
      'sprints',
      'estimates.hours',
      'milestones',
      'schedule',
      'wip',
    ])
    expect(idsOf('Acompanhamento')).toEqual([
      'checkins',
      'cost',
      'reviewRetro',
      'burndown',
      'flowMetrics',
      'baseline',
    ])
    expect(idsOf('Outros')).toEqual([
      'agenda',
      'impediments',
      'acceptance',
      'subtasks',
      'estimates.points',
    ])
    const rows = groups.flatMap((group) => group.rows.map((row) => row.id))
    expect(rows).not.toContain('core')
    expect(rows).not.toContain('integrations')
    expect(rows).toHaveLength(LISTED_MODULE_IDS.length)
  })

  it('usa o nome do manifesto e a etiqueta de nível; descrição e dependência são as do design', () => {
    const backlog = buildModuleGroups(ALL)[0]!.rows[0]!
    expect(backlog).toMatchObject({
      id: 'backlog',
      name: 'Backlog',
      levelTag: 'N1',
      objective: 'Fila em ordem do que vem a seguir.',
      dependency: 'Só o núcleo',
    })
  })

  it('mantém no grupo "Outros" o texto do manifesto (o design não tem esses módulos)', () => {
    const agenda = buildModuleGroups(ALL)[3]!.rows[0]!
    expect(agenda).toMatchObject({
      id: 'agenda',
      objective: 'Ver e marcar os compromissos da equipe.',
      dependency: 'Só o núcleo',
    })
  })

  it('usa a dependência e a descrição do design nos módulos listados (ex.: Cerimônias, Cronograma)', () => {
    const rows = buildModuleGroups(ALL).flatMap((group) => group.rows)
    expect(rows.find((row) => row.id === 'reviewRetro')!.dependency).toBe('Requer Sprints')
    expect(rows.find((row) => row.id === 'schedule')!.dependency).toBe('Aproveita EAP, Marcos')
    expect(rows.find((row) => row.id === 'baseline')!.dependency).toBe('Requer Cronograma')
  })

  it('marca Avançado nos N3 e Em encerramento no que está encerrando', () => {
    const rows = buildModuleGroups(
      projectModulesView({ enabled: ['backlog'], winding: ['risks', 'burndown'] }).modules,
    ).flatMap((group) => group.rows)
    const risks = rows.find((row) => row.id === 'risks')!
    expect(risks.signals).toEqual(['Avançado', 'Em encerramento'])
    expect(risks.enabled).toBe(true)
    expect(risks.windingDown).toBe(true)
    expect(rows.find((row) => row.id === 'burndown')!.signals).toEqual(['Em encerramento'])
    expect(rows.find((row) => row.id === 'backlog')!.signals).toEqual([])
    expect(rows.find((row) => row.id === 'sprints')!.enabled).toBe(false)
  })
})

describe('dependencyText', () => {
  it('diz "Só o núcleo" quando a única dependência é o núcleo', () => {
    expect(dependencyText({ requires: ['core'], enhances: [] })).toBe('Só o núcleo')
  })

  it('lista o que é exigido e o que é aproveitado, com nomes do manifesto', () => {
    expect(dependencyText({ requires: ['backlog'], enhances: [] })).toBe('Requer Backlog')
    expect(dependencyText({ requires: ['core'], enhances: ['wbs'] })).toBe(
      'Aproveita EAP (Entregas)',
    )
    expect(dependencyText({ requires: ['backlog'], enhances: ['estimates.hours'] })).toBe(
      'Requer Backlog · Aproveita Estimativa',
    )
  })
})

describe('summarizeModules', () => {
  it('conta ligados e encerrando, sobre os 15 módulos do design', () => {
    const summary = summarizeModules(
      projectModulesView({ enabled: ['backlog', 'sprints'], winding: ['cost'] }).modules,
    )
    expect(summary).toEqual({ enabled: 3, total: 15 })
  })

  it('não conta o núcleo, Plug-ins nem os módulos do grupo "Outros"', () => {
    const summary = summarizeModules(
      projectModulesView({ enabled: ['integrations', 'agenda', 'subtasks'] }).modules,
    )
    expect(summary).toEqual({ enabled: 0, total: 15 })
  })
})

describe('previewToggle', () => {
  const core: ModuleId[] = ['core']

  it('ligar Sprints traz o Backlog junto', () => {
    const preview = previewToggle(core, 'sprints', true)
    expect(preview).toEqual({ kind: 'enable', alsoEnables: ['Backlog'], alsoDisables: [] })
  })

  it('ligar sem dependência não traz nada junto', () => {
    const preview = previewToggle(core, 'backlog', true)
    expect(preview).toEqual({ kind: 'enable', alsoEnables: [], alsoDisables: [] })
  })

  it('recusa ligar módulo em conflito, com o texto do que desligar', () => {
    const preview = previewToggle(['core', 'estimates.hours'], 'estimates.points', true)
    expect(preview.refused).toBe(
      'Não dá para ligar Estimativa em pontos junto com Estimativa: são ferramentas em conflito. Desligue Estimativa antes.',
    )
  })

  it('desligar Backlog traz Sprints e Burndown junto', () => {
    // Burndown exige Sprints e, além disso, horas ou pontos: com horas ligadas, ele depende do Backlog por Sprints.
    const current: ModuleId[] = ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown']
    const preview = previewToggle(current, 'backlog', false)
    expect(preview).toEqual({
      kind: 'disable',
      alsoEnables: [],
      alsoDisables: ['Sprints', 'Burndown e velocidade'],
    })
  })
})

describe('effectsOf', () => {
  it('lista o módulo pedido e o que entra junto, com o estado de cada um', () => {
    const preview = previewToggle(['core'], 'sprints', true)
    expect(effectsOf('sprints', preview)).toEqual([
      { name: 'Sprints', state: 'ligado' },
      { name: 'Backlog', state: 'ligado junto' },
    ])
  })

  it('no desligamento, lista o que sai junto', () => {
    const current: ModuleId[] = ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown']
    const preview = previewToggle(current, 'backlog', false)
    expect(effectsOf('backlog', preview)).toEqual([
      { name: 'Backlog', state: 'desligado' },
      { name: 'Sprints', state: 'desligado junto' },
      { name: 'Burndown e velocidade', state: 'desligado junto' },
    ])
  })

  it('sem nada junto, mostra só o próprio módulo; recusado, não mostra efeito', () => {
    expect(effectsOf('risks', previewToggle(['core', 'risks'], 'risks', false))).toEqual([
      { name: 'Riscos', state: 'desligado' },
    ])
    const refused = previewToggle(['core', 'estimates.hours'], 'estimates.points', true)
    expect(effectsOf('estimates.points', refused)).toEqual([])
  })
})

describe('linkedOf', () => {
  it('"Liga junto, porque X precisa:" ao ligar com dependência', () => {
    const preview = previewToggle(['core'], 'sprints', true)
    expect(linkedOf('sprints', preview)).toEqual({
      label: 'Liga junto, porque Sprints precisa:',
      names: ['Backlog'],
    })
  })

  it('"Sai junto, porque depende de X:" ao desligar com dependentes', () => {
    const current: ModuleId[] = ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown']
    const preview = previewToggle(current, 'backlog', false)
    expect(linkedOf('backlog', preview)).toEqual({
      label: 'Sai junto, porque depende de Backlog:',
      names: ['Sprints', 'Burndown e velocidade'],
    })
  })

  it('é null quando nada entra ou sai junto, ou quando a mudança é recusada', () => {
    expect(linkedOf('backlog', previewToggle(['core'], 'backlog', true))).toBeNull()
    expect(linkedOf('risks', previewToggle(['core', 'risks'], 'risks', false))).toBeNull()
    expect(
      linkedOf(
        'estimates.points',
        previewToggle(['core', 'estimates.hours'], 'estimates.points', true),
      ),
    ).toBeNull()
  })
})

describe('startedFromText', () => {
  it('usa o nome completo da metodologia de partida', () => {
    expect(startedFromText('agil')).toBe('Começou como Ágil')
    expect(startedFromText('tradicional')).toBe('Começou como Tradicional')
    expect(startedFromText('hibrido')).toBe('Começou como Híbrido')
    expect(startedFromText('kanban')).toBe('Começou como Kanban')
    expect(startedFromText('simples')).toBe('Começou como Simples')
  })

  it('não mostra selo sem preset', () => {
    expect(startedFromText(null)).toBeNull()
    expect(startedFromText(undefined)).toBeNull()
  })
})

describe('enabledIdsOf', () => {
  it('inclui o núcleo e os módulos ligados ou encerrando', () => {
    const ids = enabledIdsOf(
      projectModulesView({ enabled: ['backlog'], winding: ['cost'] }).modules,
    )
    expect(ids).toEqual(['core', 'backlog', 'cost'])
  })
})

describe('scheduledText', () => {
  it('descreve a sprint ativa sem dizer que algo foi agendado', () => {
    expect(scheduledText('sprints', 'active_sprint')).toBe(
      'Não dá para desligar Sprints agora: há uma sprint ativa. Termine a sprint antes.',
    )
  })
})
