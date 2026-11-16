import { describe, expect, it } from 'vitest'
import { TEAM_PRESETS } from './presets'
import { dependentsOf, resolveModuleSet } from './resolve'
import { MODULE_IDS } from './registry'
import type { ModuleId } from './registry'

/** Ids em ordem do catálogo, para comparar conjuntos sem depender da ordem de entrada. */
function inCatalog(ids: readonly ModuleId[]): ModuleId[] {
  return MODULE_IDS.filter((id) => ids.includes(id))
}

/** Aplica um pedido que deve ser aceito e devolve o conjunto final. */
function apply(
  current: readonly ModuleId[],
  enable: ModuleId[] = [],
  disable: ModuleId[] = [],
): ModuleId[] {
  const result = resolveModuleSet(current, { enable, disable })
  if (!result.ok) throw new Error(`esperado ok, veio ${result.reason}`)
  return result.enabled
}

/** Id que não existe no catálogo, para testar pedidos inválidos. */
function unsafeId(id: string): ModuleId {
  return id as ModuleId
}

/** Conjunto da scrum-complete, usado em vários cenários. */
const SCRUM_COMPLETE = TEAM_PRESETS.find((preset) => preset.id === 'scrum-complete')?.modules ?? []

describe('resolveModuleSet: ativar puxa dependências', () => {
  it('sprints sem backlog ativa os dois e informa o backlog em autoEnabled', () => {
    const result = resolveModuleSet(['core'], { enable: ['sprints'] })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints'],
      autoEnabled: ['backlog'],
    })
  })

  it('não inclui em autoEnabled o que foi pedido explicitamente', () => {
    const result = resolveModuleSet(['core'], { enable: ['backlog', 'sprints'] })
    expect(result).toMatchObject({ ok: true, autoEnabled: [] })
  })

  it('puxa dependências transitivas (reviewRetro exige sprints, que exige backlog; e agenda)', () => {
    const result = resolveModuleSet(['core'], { enable: ['reviewRetro'] })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'agenda', 'backlog', 'sprints', 'reviewRetro'],
      autoEnabled: ['agenda', 'backlog', 'sprints'],
    })
  })

  it('burndown sem horas nem pontos puxa horas, a primeira alternativa (ADR-07)', () => {
    const result = resolveModuleSet(['core', 'backlog', 'sprints'], { enable: ['burndown'] })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'],
      autoEnabled: ['estimates.hours'],
    })
  })

  it('burndown não puxa nada quando pontos já satisfaz a alternativa', () => {
    const result = resolveModuleSet(['core', 'backlog', 'sprints', 'estimates.points'], {
      enable: ['burndown'],
    })
    expect(result).toMatchObject({ ok: true, autoEnabled: [] })
  })

  it('ativar algo já ativo não muda nada', () => {
    const result = resolveModuleSet(['core', 'backlog', 'sprints'], { enable: ['sprints'] })
    expect(result).toEqual({ ok: true, enabled: ['core', 'backlog', 'sprints'], autoEnabled: [] })
  })
})

describe('resolveModuleSet: desativar é bloqueado enquanto alguém depende', () => {
  it('desligar backlog com sprints ativo é recusado e lista o dependente', () => {
    const result = resolveModuleSet(['core', 'backlog', 'sprints'], { disable: ['backlog'] })
    expect(result).toEqual({
      ok: false,
      reason: 'blocked_by_dependents',
      conflicts: [],
      blockedBy: ['sprints'],
      dependents: [{ module: 'backlog', requiredBy: ['sprints'] }],
      unknownIds: [],
    })
  })

  it('lista quem depende de quem quando a cadeia fica quebrada (sprints sai junto com backlog)', () => {
    const current: ModuleId[] = ['core', 'agenda', 'backlog', 'sprints', 'reviewRetro']
    const result = resolveModuleSet(current, { disable: ['backlog', 'sprints'] })
    expect(result).toMatchObject({
      ok: false,
      reason: 'blocked_by_dependents',
      blockedBy: ['reviewRetro'],
      dependents: [{ module: 'sprints', requiredBy: ['reviewRetro'] }],
    })
  })

  it('desligar backlog e sprints juntos é permitido', () => {
    const result = resolveModuleSet(['core', 'backlog', 'sprints'], {
      disable: ['backlog', 'sprints'],
    })
    expect(result).toEqual({ ok: true, enabled: ['core'], autoEnabled: [] })
  })

  it('desligar horas com burndown ativo e sem pontos bloqueia', () => {
    const current: ModuleId[] = ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown']
    const result = resolveModuleSet(current, { disable: ['estimates.hours'] })
    expect(result).toMatchObject({
      ok: false,
      reason: 'blocked_by_dependents',
      blockedBy: ['burndown'],
      dependents: [{ module: 'estimates.hours', requiredBy: ['burndown'] }],
    })
  })

  it('trocar horas por pontos com burndown ativo não bloqueia, porque pontos passa a satisfazer a alternativa', () => {
    const current: ModuleId[] = ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown']
    const result = resolveModuleSet(current, {
      disable: ['estimates.hours'],
      enable: ['estimates.points'],
    })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints', 'estimates.points', 'burndown'],
      autoEnabled: [],
    })
  })

  it('desligar um módulo sem dependentes ativos é permitido', () => {
    const result = resolveModuleSet(['core', 'agenda', 'backlog'], { disable: ['agenda'] })
    expect(result).toEqual({ ok: true, enabled: ['core', 'backlog'], autoEnabled: [] })
  })
})

describe('resolveModuleSet: conflitos são exclusivos', () => {
  it('ativar pontos com horas ativo é recusado com o par ordenado pelo catálogo', () => {
    const result = resolveModuleSet(['core', 'estimates.hours'], { enable: ['estimates.points'] })
    expect(result).toMatchObject({
      ok: false,
      reason: 'conflict',
      conflicts: [['estimates.hours', 'estimates.points']],
    })
  })

  it('ativar horas e pontos no mesmo pedido é recusado', () => {
    const result = resolveModuleSet(['core'], {
      enable: ['estimates.points', 'estimates.hours'],
    })
    expect(result).toMatchObject({
      ok: false,
      reason: 'conflict',
      conflicts: [['estimates.hours', 'estimates.points']],
    })
  })

  it('trocar horas por pontos no mesmo pedido é aceito, porque o conflito deixa de existir', () => {
    const result = resolveModuleSet(['core', 'estimates.hours'], {
      enable: ['estimates.points'],
      disable: ['estimates.hours'],
    })
    expect(result).toEqual({ ok: true, enabled: ['core', 'estimates.points'], autoEnabled: [] })
  })

  it('pares antigos em conflito que já estavam em current não recusam uma mudança sem relação', () => {
    const current: ModuleId[] = ['core', 'estimates.hours', 'estimates.points']
    const result = resolveModuleSet(current, { enable: ['agenda'] })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'agenda', 'estimates.hours', 'estimates.points'],
      autoEnabled: [],
    })
  })
})

describe('resolveModuleSet: desativar e reativar devolve o mesmo conjunto', () => {
  it('desligar e religar reviewRetro no conjunto Scrum completo devolve o conjunto original', () => {
    const off = apply(SCRUM_COMPLETE, [], ['reviewRetro'])
    expect(off).not.toContain('reviewRetro')
    const on = apply(off, ['reviewRetro'])
    expect(on).toEqual(inCatalog(SCRUM_COMPLETE))
  })

  it('desligar backlog e sprints e depois religar sprints traz backlog de volta por dependência', () => {
    const off = apply(SCRUM_COMPLETE, [], ['reviewRetro', 'burndown', 'sprints', 'backlog'])
    const result = resolveModuleSet(off, { enable: ['sprints'] })
    expect(result).toEqual({
      ok: true,
      enabled: inCatalog([...off, 'backlog', 'sprints']),
      autoEnabled: ['backlog'],
    })
  })
})

describe('resolveModuleSet: ordem, duplicatas e idempotência', () => {
  it('enabled sai na ordem do catálogo, qualquer que seja a ordem de entrada', () => {
    const result = resolveModuleSet(['estimates.hours', 'backlog', 'core'], { enable: ['sprints'] })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints', 'estimates.hours'],
      autoEnabled: [],
    })
  })

  it('não repete módulos quando current ou o pedido repetem ids', () => {
    const result = resolveModuleSet(['core', 'core'], {
      enable: ['sprints', 'sprints', 'agenda'],
    })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'agenda', 'backlog', 'sprints'],
      autoEnabled: ['backlog'],
    })
  })

  it('ativar sprints que já está ativo não puxa dependências, mesmo com current inconsistente', () => {
    const result = resolveModuleSet(['core', 'sprints'], { enable: ['sprints', 'agenda'] })
    expect(result).toEqual({ ok: true, enabled: ['core', 'agenda', 'sprints'], autoEnabled: [] })
  })

  it('desativar o que já está desativado não muda nada', () => {
    expect(resolveModuleSet(['core'], { disable: ['sprints'] })).toEqual({
      ok: true,
      enabled: ['core'],
      autoEnabled: [],
    })
  })

  it('aplicar o mesmo pedido duas vezes dá o mesmo resultado', () => {
    const once = apply(['core'], ['sprints'])
    expect(apply(once, ['sprints'])).toEqual(once)
  })

  it('sem pedido, devolve só o núcleo', () => {
    expect(resolveModuleSet([], {})).toEqual({ ok: true, enabled: ['core'], autoEnabled: [] })
  })

  it('o núcleo entra mesmo quando current não o tem, e não aparece em autoEnabled', () => {
    expect(resolveModuleSet([], { enable: ['core'] })).toEqual({
      ok: true,
      enabled: ['core'],
      autoEnabled: [],
    })
  })
})

describe('resolveModuleSet: núcleo', () => {
  it('desligar o núcleo é recusado com reason core_required', () => {
    expect(resolveModuleSet(['core'], { disable: ['core'] })).toEqual({
      ok: false,
      reason: 'core_required',
      conflicts: [],
      blockedBy: ['core'],
      dependents: [],
      unknownIds: [],
    })
  })
})

describe('resolveModuleSet: pedidos inválidos', () => {
  it('módulo desconhecido devolve unknown_module, sem lançar exceção', () => {
    const result = resolveModuleSet(['core'], { enable: [unsafeId('inexistente')] })
    expect(result).toEqual({
      ok: false,
      reason: 'unknown_module',
      conflicts: [],
      blockedBy: [],
      dependents: [],
      unknownIds: ['inexistente'],
    })
  })

  it('módulo desconhecido em disable também é recusado', () => {
    const result = resolveModuleSet(['core'], { disable: [unsafeId('xyz')] })
    expect(result).toMatchObject({ ok: false, reason: 'unknown_module', unknownIds: ['xyz'] })
  })

  it('ligar e desligar o mesmo módulo no mesmo pedido é recusado como conflicting_request', () => {
    const result = resolveModuleSet(['core'], { enable: ['agenda'], disable: ['agenda'] })
    expect(result).toMatchObject({ ok: false, reason: 'conflicting_request' })
  })

  it('ligar um módulo que exige outro que o pedido manda desligar é conflicting_request', () => {
    const result = resolveModuleSet(['core', 'backlog'], {
      enable: ['sprints'],
      disable: ['backlog'],
    })
    expect(result).toMatchObject({ ok: false, reason: 'conflicting_request' })
  })

  it('ids fora do catálogo em current são ignorados e não aparecem em enabled', () => {
    const result = resolveModuleSet(['core', unsafeId('fantasma')], {})
    expect(result).toEqual({ ok: true, enabled: ['core'], autoEnabled: [] })
  })
})

describe('resolveModuleSet: estado atual inconsistente é dado, não recalculado', () => {
  it('sprints ativo sem backlog não faz a função puxar backlog para uma mudança sem relação', () => {
    const result = resolveModuleSet(['core', 'sprints'], { enable: ['checkins'] })
    expect(result).toEqual({
      ok: true,
      enabled: ['core', 'sprints', 'checkins'],
      autoEnabled: [],
    })
  })

  it('a inconsistência anterior não bloqueia o desligamento de algo sem relação', () => {
    const result = resolveModuleSet(['core', 'sprints', 'agenda'], { disable: ['agenda'] })
    expect(result).toEqual({ ok: true, enabled: ['core', 'sprints'], autoEnabled: [] })
  })
})

describe('dependentsOf', () => {
  it('lista quem perde a dependência ao desligar backlog', () => {
    expect(dependentsOf(['core', 'backlog', 'sprints'], 'backlog')).toEqual(['sprints'])
  })

  it('lista quem depende de agenda (reviewRetro exige agenda e sprints)', () => {
    expect(dependentsOf(['core', 'agenda', 'backlog', 'sprints', 'reviewRetro'], 'agenda')).toEqual(
      ['reviewRetro'],
    )
  })

  it('não lista dependentes indiretos (reviewRetro não depende de backlog diretamente)', () => {
    expect(
      dependentsOf(['core', 'agenda', 'backlog', 'sprints', 'reviewRetro'], 'backlog'),
    ).toEqual(['sprints'])
  })

  it('devolve vazio quando ninguém depende do módulo', () => {
    expect(dependentsOf(['core', 'backlog', 'sprints', 'burndown'], 'burndown')).toEqual([])
  })

  it('devolve vazio quando o módulo não está nos ativos', () => {
    expect(dependentsOf(['core', 'backlog'], 'sprints')).toEqual([])
  })

  it('considera a alternativa de requiresAnyOf: burndown com horas só conta como dependente de horas', () => {
    expect(
      dependentsOf(
        ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'],
        'estimates.hours',
      ),
    ).toEqual(['burndown'])
  })

  it('ids fora do catálogo são ignorados', () => {
    expect(dependentsOf(['core', 'backlog', 'sprints', unsafeId('fantasma')], 'backlog')).toEqual([
      'sprints',
    ])
  })
})

describe('presets aplicados sobre o núcleo', () => {
  it.each(TEAM_PRESETS.map((preset) => [preset.id, preset] as const))(
    '%s resulta exatamente no conjunto do preset, sem dependências extras',
    (_id, preset) => {
      const result = resolveModuleSet(['core'], { enable: [...preset.modules] })
      expect(result).toEqual({
        ok: true,
        enabled: inCatalog(preset.modules),
        autoEnabled: [],
      })
    },
  )
})
