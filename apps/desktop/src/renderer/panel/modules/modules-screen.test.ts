import { describe, expect, it } from 'vitest'
import type { ModuleId } from '@agilebox/core'
import { projectModulesView } from '../../shared/testing/project-modules-fixture'
import {
  buildModuleGroups,
  dependencyText,
  enabledIdsOf,
  LISTED_MODULE_IDS,
  previewLines,
  previewToggle,
  scheduledText,
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

  it('usa o nome e o objetivo do manifesto e a etiqueta de nível', () => {
    const backlog = buildModuleGroups(ALL)[0]!.rows[0]!
    expect(backlog).toMatchObject({
      id: 'backlog',
      name: 'Backlog',
      levelTag: 'N1',
      objective: 'Saber o que vem a seguir, em ordem.',
    })
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
  it('conta ligados e encerrando, sobre os módulos listados', () => {
    const summary = summarizeModules(
      projectModulesView({ enabled: ['backlog', 'sprints'], winding: ['cost'] }).modules,
    )
    expect(summary).toEqual({ enabled: 3, total: 20 })
  })

  it('não conta o núcleo nem Plug-ins', () => {
    const summary = summarizeModules(projectModulesView({ enabled: ['integrations'] }).modules)
    expect(summary).toEqual({ enabled: 0, total: 20 })
  })
})

describe('previewToggle', () => {
  const core: ModuleId[] = ['core']

  it('ligar Sprints avisa que o Backlog entra junto', () => {
    const preview = previewToggle(core, 'sprints', true)
    expect(preview).toEqual({ kind: 'enable', alsoEnables: ['Backlog'], alsoDisables: [] })
    expect(previewLines('sprints', preview)).toEqual(['Sprints precisa de Backlog. Ligamos junto?'])
  })

  it('ligar sem dependência não traz nada junto', () => {
    const preview = previewToggle(core, 'backlog', true)
    expect(preview).toEqual({ kind: 'enable', alsoEnables: [], alsoDisables: [] })
    expect(previewLines('backlog', preview)).toEqual([])
  })

  it('recusa ligar módulo em conflito, com o texto do que desligar', () => {
    const preview = previewToggle(['core', 'estimates.hours'], 'estimates.points', true)
    expect(preview.refused).toBe(
      'Não dá para ligar Estimativa em pontos junto com Estimativa: são ferramentas em conflito. Desligue Estimativa antes.',
    )
    expect(previewLines('estimates.points', preview)).toEqual([preview.refused])
  })

  it('desligar Backlog avisa que Sprints e Burndown saem junto', () => {
    // Burndown exige Sprints e, além disso, horas ou pontos: com horas ligadas, ele depende do Backlog por Sprints.
    const current: ModuleId[] = ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown']
    const preview = previewToggle(current, 'backlog', false)
    expect(preview).toEqual({
      kind: 'disable',
      alsoEnables: [],
      alsoDisables: ['Sprints', 'Burndown e velocidade'],
    })
    expect(previewLines('backlog', preview)).toEqual([
      'Sai junto, porque depende de Backlog: Sprints, Burndown e velocidade.',
      'Nada é apagado. Religar restaura os dados.',
    ])
  })

  it('desligar sem dependentes só avisa que nada é apagado', () => {
    const preview = previewToggle(['core', 'risks'], 'risks', false)
    expect(preview.alsoDisables).toEqual([])
    expect(previewLines('risks', preview)).toEqual(['Nada é apagado. Religar restaura os dados.'])
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
