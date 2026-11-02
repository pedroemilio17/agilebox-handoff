import { describe, expect, it } from 'vitest'
import { MODULE_IDS, TEAM_PRESETS, type ModuleId } from '@agilebox/core'
import {
  TOOL_IDS,
  applyPreset,
  dependencyGroups,
  draftFromStatuses,
  presetMatching,
  toggleTool,
  toolSignal,
} from './tool-draft'

const ACTIVE_BASE: readonly ModuleId[] = ['core', 'agenda']

describe('ferramentas mostradas na tela', () => {
  it('não mostra estimativa por pontos (D8) nem os módulos do M10', () => {
    for (const hidden of [
      'estimates.points',
      'wip',
      'subtasks',
      'flowMetrics',
      'reviewRetro',
      'burndown',
    ] as const) {
      expect(TOOL_IDS).not.toContain(hidden)
    }
  })

  it('só lista módulos do catálogo, sem repetir', () => {
    expect(new Set(TOOL_IDS).size).toBe(TOOL_IDS.length)
    for (const id of TOOL_IDS) expect(MODULE_IDS).toContain(id)
  })
})

describe('rascunho inicial', () => {
  it('ferramenta ativa entra; encerrando e desligada não entram', () => {
    const draft = draftFromStatuses([
      { moduleId: 'core', state: 'active' },
      { moduleId: 'agenda', state: 'active' },
      { moduleId: 'backlog', state: 'winding_down' },
      { moduleId: 'sprints', state: 'disabled' },
    ])

    expect(draft).toEqual(['core', 'agenda'])
  })

  it('o núcleo entra sempre, mesmo se o servidor não o devolver', () => {
    expect(draftFromStatuses([])).toEqual(['core'])
  })

  it('segue a ordem do catálogo', () => {
    const draft = draftFromStatuses([
      { moduleId: 'integrations', state: 'active' },
      { moduleId: 'agenda', state: 'active' },
      { moduleId: 'core', state: 'active' },
    ])

    expect(draft).toEqual(['core', 'agenda', 'integrations'])
  })
})

describe('ligar uma ferramenta no rascunho', () => {
  it('ligar Sprints puxa Backlog e informa que foi automático', () => {
    const result = toggleTool(ACTIVE_BASE, 'sprints', true)

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'agenda', 'backlog', 'sprints'],
      pulled: ['backlog'],
      leaving: [],
    })
  })

  it('ligar uma ferramenta sem dependências não puxa nada', () => {
    const result = toggleTool(ACTIVE_BASE, 'integrations', true)

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'agenda', 'integrations'],
      pulled: [],
      leaving: [],
    })
  })

  it('ligar Aceite puxa Backlog, de que ele depende', () => {
    const result = toggleTool(ACTIVE_BASE, 'acceptance', true)

    expect(result.ok && result.pulled).toEqual(['backlog'])
  })

  it('ligar Check-ins com Backlog e Sprints fora puxa os dois, em cadeia', () => {
    const result = toggleTool(ACTIVE_BASE, 'checkins', true)

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'agenda', 'backlog', 'sprints', 'checkins'],
      pulled: ['backlog', 'sprints'],
      leaving: [],
    })
  })

  it('ligar horas com pontos ativos no servidor funciona: pontos sai do rascunho sem aviso', () => {
    const result = toggleTool(['core', 'estimates.points'], 'estimates.hours', true)

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'estimates.hours'],
      pulled: [],
      leaving: [],
    })
  })

  it('ligar horas tira pontos (sem cartão) e mantém Retro, que não conflita', () => {
    const result = toggleTool(
      ['core', 'backlog', 'sprints', 'estimates.points', 'reviewRetro'],
      'estimates.hours',
      true,
    )

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'backlog', 'sprints', 'estimates.hours', 'reviewRetro'],
      pulled: [],
      leaving: [],
    })
  })
})

describe('desligar uma ferramenta no rascunho', () => {
  it('desligar Backlog com Sprints ligada tira as duas, e Sprints aparece como saída', () => {
    const result = toggleTool(['core', 'backlog', 'sprints'], 'backlog', false)

    expect(result).toEqual({ ok: true, draft: ['core'], pulled: [], leaving: ['sprints'] })
  })

  it('desligar uma folha não tira nada junto', () => {
    const result = toggleTool(['core', 'agenda', 'backlog'], 'agenda', false)

    expect(result).toEqual({ ok: true, draft: ['core', 'backlog'], pulled: [], leaving: [] })
  })

  it('o núcleo não pode sair do rascunho', () => {
    const result = toggleTool(['core', 'agenda'], 'core', false)

    expect(result.ok).toBe(false)
  })

  it('desligar Sprints com Retro ativa funciona e Retro não aparece como saída', () => {
    const result = toggleTool(
      ['core', 'agenda', 'backlog', 'sprints', 'reviewRetro'],
      'sprints',
      false,
    )

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'agenda', 'backlog'],
      pulled: [],
      leaving: [],
    })
  })

  it('desligar Sprints com Check-ins e Retro ativas: só Check-ins aparece como saída', () => {
    const result = toggleTool(
      ['core', 'backlog', 'sprints', 'checkins', 'reviewRetro'],
      'sprints',
      false,
    )

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'backlog'],
      pulled: [],
      leaving: ['checkins'],
    })
  })

  it('desligar horas com Burndown ativo (pontos fora) tira o Burndown sem aviso', () => {
    const result = toggleTool(
      ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'],
      'estimates.hours',
      false,
    )

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'backlog', 'sprints'],
      pulled: [],
      leaving: [],
    })
  })

  it('desligar Backlog com Burndown ativo: Sprints aparece como saída, Burndown não', () => {
    const result = toggleTool(
      ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'],
      'backlog',
      false,
    )

    expect(result).toEqual({
      ok: true,
      draft: ['core', 'estimates.hours'],
      pulled: [],
      leaving: ['sprints'],
    })
  })
})

describe('módulos sem cartão no rascunho', () => {
  it('mantém módulo sem cartão ativo no servidor, para a prévia do M2.10b comparar com o gravado', () => {
    const draft = draftFromStatuses([
      { moduleId: 'core', state: 'active' },
      { moduleId: 'estimates.points', state: 'active' },
    ])

    expect(draft).toEqual(['core', 'estimates.points'])
  })
})

describe('presets', () => {
  it('Quadro simples é Quadro, Agenda e Backlog', () => {
    expect(applyPreset('quadroSimples')).toEqual(['core', 'agenda', 'backlog'])
  })

  it('Scrum do time traz Sprints, check-ins e impedimentos, sem integrações', () => {
    const draft = applyPreset('scrumDoTime')

    expect(draft).toEqual(
      expect.arrayContaining(['core', 'backlog', 'sprints', 'checkins', 'impediments']),
    )
    expect(draft).not.toContain('integrations')
  })

  it('Completo traz tudo o que existe hoje, com integrações', () => {
    const draft = applyPreset('completo')

    expect(draft).toEqual(expect.arrayContaining([...TEAM_PRESETS.completo]))
    expect(draft).toContain('integrations')
  })

  it('presetMatching reconhece o preset só quando o rascunho é exatamente ele', () => {
    expect(presetMatching(applyPreset('quadroSimples'))).toBe('quadroSimples')
    expect(presetMatching(['core', 'agenda', 'backlog', 'acceptance'])).toBeNull()
  })
})

describe('sinal de estado (texto, não só cor)', () => {
  it('ligada quando está no rascunho, mesmo se o servidor a encerra', () => {
    expect(toolSignal(true, 'active')).toBe('on')
    expect(toolSignal(true, 'winding_down')).toBe('on')
  })

  it('encerrando quando sai e o servidor ainda a mantém em encerramento', () => {
    expect(toolSignal(false, 'winding_down')).toBe('winding')
  })

  it('desligada nos demais casos', () => {
    expect(toolSignal(false, 'active')).toBe('off')
    expect(toolSignal(false, 'disabled')).toBe('off')
  })
})

describe('dependências declaradas', () => {
  it('lista o que a ferramenta exige, direto do registro, um grupo por exigência', () => {
    expect(dependencyGroups('sprints')).toEqual([['backlog']])
    expect(dependencyGroups('checkins')).toEqual([['sprints']])
    expect(dependencyGroups('acceptance')).toEqual([['backlog']])
  })

  it('alternativas de requiresAnyOf ficam num mesmo grupo (uma basta)', () => {
    expect(dependencyGroups('burndown')).toEqual([
      ['sprints'],
      ['estimates.hours', 'estimates.points'],
    ])
  })

  it('ferramenta sem exigência devolve lista vazia', () => {
    expect(dependencyGroups('agenda')).toEqual([])
  })
})
