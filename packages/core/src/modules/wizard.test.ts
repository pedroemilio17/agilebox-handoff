import { describe, expect, it } from 'vitest'
import { PROJECT_PRESETS, getProjectPreset, projectPresetModules } from './project-presets'
import type { ProjectPresetKey } from './project-presets'
import { resolveModuleSet } from './resolve'
import { recommendPreset, recommendationNote, recommendationSummary } from './wizard'
import type { WizardAnswers } from './wizard'

/** As respostas do exemplo do design `Recomendacao.dc.html` ("App de Chamados"). */
const DESIGN_EXAMPLE: WizardAnswers = {
  workType: 'finite',
  fixedDate: 'no',
  scope: 'will_change',
  controlsHoursAndCost: 'yes',
  experience: 'sometimes',
}

/** Respostas mínimas que caem em cada preset (usadas nos testes de ajuste). */
const ANSWERS_BY_PRESET: Readonly<Record<ProjectPresetKey, WizardAnswers>> = {
  simples: {},
  kanban: { workType: 'continuous' },
  agil: { workType: 'finite', fixedDate: 'no', scope: 'defined' },
  tradicional: { workType: 'finite', fixedDate: 'yes', scope: 'defined' },
  hibrido: { workType: 'finite', fixedDate: 'yes', scope: 'partly' },
}

/** Remove as chaves ausentes, para montar respostas parciais sem `undefined` explícito. */
function definedOnly(answers: Record<string, unknown>): WizardAnswers {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value !== undefined))
}

const PRESET_KEYS = PROJECT_PRESETS.map((preset) => preset.key)

describe('recommendPreset (ADR-10, assistente de criação)', () => {
  it.each([
    [
      'contínuo ignora data e escopo',
      { workType: 'continuous', fixedDate: 'yes', scope: 'defined' },
      'kanban',
    ],
    [
      'finito, data fixa, escopo definido',
      { workType: 'finite', fixedDate: 'yes', scope: 'defined' },
      'tradicional',
    ],
    [
      'finito, data fixa, escopo parcial',
      { workType: 'finite', fixedDate: 'yes', scope: 'partly' },
      'hibrido',
    ],
    [
      'finito, data fixa, escopo muda',
      { workType: 'finite', fixedDate: 'yes', scope: 'will_change' },
      'hibrido',
    ],
    [
      'finito, sem data fixa, escopo parcial',
      { workType: 'finite', fixedDate: 'no', scope: 'partly' },
      'agil',
    ],
    [
      'finito, sem data fixa, escopo muda',
      { workType: 'finite', fixedDate: 'no', scope: 'will_change' },
      'agil',
    ],
    [
      'finito, sem data fixa, escopo definido',
      { workType: 'finite', fixedDate: 'no', scope: 'defined' },
      'agil',
    ],
  ] as const)('%s => %s', (_label, answers, preset) => {
    expect(recommendPreset(answers).preset).toBe(preset)
  })

  it.each([
    ['trabalho desconhecido', { workType: 'unknown', fixedDate: 'yes', scope: 'defined' }],
    ['trabalho ausente', { fixedDate: 'yes', scope: 'defined' }],
    ['data desconhecida', { workType: 'finite', fixedDate: 'unknown', scope: 'defined' }],
    ['data ausente', { workType: 'finite', scope: 'defined' }],
    [
      'escopo desconhecido com data fixa',
      { workType: 'finite', fixedDate: 'yes', scope: 'unknown' },
    ],
    [
      'escopo desconhecido sem data fixa',
      { workType: 'finite', fixedDate: 'no', scope: 'unknown' },
    ],
    ['escopo ausente sem data fixa', { workType: 'finite', fixedDate: 'no' }],
  ] as const)('%s => simples', (_label, answers) => {
    expect(recommendPreset(answers).preset).toBe('simples')
  })

  it('pulou tudo => simples, só com o núcleo e sem motivos', () => {
    const result = recommendPreset({})
    expect(result).toEqual({
      preset: 'simples',
      modules: ['core'],
      reasons: [],
      guideLevel: 'never',
    })
  })

  it.each([
    ['data fixa', { fixedDate: 'yes', scope: 'defined' }],
    ['data sem definir', { fixedDate: 'no', scope: 'will_change' }],
    ['escopo ausente', { fixedDate: 'yes' }],
  ] as const)('contínuo ignora %s', (_label, dates) => {
    const answers: WizardAnswers = { workType: 'continuous', ...dates }
    expect(recommendPreset(answers).preset).toBe('kanban')
  })

  it.each(PRESET_KEYS.map((key) => [key] as const))(
    'pergunta "fora acompanha" liga marcos em %s',
    (key) => {
      const result = recommendPreset({ ...ANSWERS_BY_PRESET[key], outsiderFollows: 'yes' })
      expect(result.preset).toBe(key)
      expect(result.modules).toContain('milestones')
      expect(result.reasons.find((r) => r.moduleId === 'milestones')?.text).toBe(
        'Mostra as datas que importam para quem está de fora.',
      )
    },
  )

  it.each(PRESET_KEYS.map((key) => [key] as const))(
    'pergunta de horas e custo liga estimativas em horas e custo em %s',
    (key) => {
      const result = recommendPreset({ ...ANSWERS_BY_PRESET[key], controlsHoursAndCost: 'yes' })
      expect(result.modules).toEqual(expect.arrayContaining(['estimates.hours', 'cost']))
      expect(result.reasons.find((r) => r.moduleId === 'cost')?.text).toBe(
        'Você quer controlar custo: horas × valor/hora de cada pessoa.',
      )
    },
  )

  it.each(PRESET_KEYS.map((key) => [key] as const))(
    'só "sempre" acrescenta os extras de %s; "algumas vezes", "nunca" e ausente não acrescentam',
    (key) => {
      const base = ANSWERS_BY_PRESET[key]
      const extras = getProjectPreset(key).experiencedExtras

      const always = recommendPreset({ ...base, experience: 'always' })
      expect(always.guideLevel).toBe('always')
      expect(always.modules).toEqual(projectPresetModules(key, { experienced: true }))
      expect(always.modules).toEqual(expect.arrayContaining([...extras]))

      const sometimes = recommendPreset({ ...base, experience: 'sometimes' })
      expect(sometimes.guideLevel).toBe('sometimes')
      expect(sometimes.modules).toEqual(projectPresetModules(key, { experienced: false }))

      for (const answers of [{ ...base, experience: 'never' as const }, base]) {
        const result = recommendPreset(answers)
        expect(result.modules).toEqual(projectPresetModules(key, { experienced: false }))
      }
      expect(recommendPreset({ ...base, experience: 'never' }).guideLevel).toBe('never')
      expect(recommendPreset(base).guideLevel).toBe('never')
    },
  )

  it('Agenda entra como dependência das Cerimônias e tem motivo próprio', () => {
    const result = recommendPreset({ ...ANSWERS_BY_PRESET.agil })
    expect(result.modules).toContain('agenda')
    expect(result.reasons.find((r) => r.moduleId === 'agenda')?.text).toBe(
      'A Agenda guarda as reuniões e os compromissos da equipe.',
    )
  })

  it('usa o texto do design para o cronograma', () => {
    const result = recommendPreset(ANSWERS_BY_PRESET.tradicional)
    expect(result.reasons.find((r) => r.moduleId === 'schedule')?.text).toBe(
      'Há uma data final que não pode mudar, então o trabalho precisa de um cronograma.',
    )
  })

  it('exemplo do design: os seis motivos da lista "Vai ligar", com o texto de Recomendacao.dc.html', () => {
    const result = recommendPreset(DESIGN_EXAMPLE)
    expect(result.preset).toBe('agil')
    expect(result.modules).toEqual([
      'core',
      'agenda',
      'backlog',
      'sprints',
      'checkins',
      'estimates.hours',
      'reviewRetro',
      'cost',
    ])
    const text = (id: string) => result.reasons.find((r) => r.moduleId === id)?.text
    expect(text('backlog')).toBe(
      'A entrega vai mudar, então o trabalho precisa de uma fila em ordem.',
    )
    expect(text('sprints')).toBe('Ciclos curtos com meta para ajustar o rumo sem data fixa.')
    expect(text('estimates.hours')).toBe(
      'Você quer controlar horas, e as sprints usam horas para a capacidade.',
    )
    expect(text('cost')).toBe('Você quer controlar custo: horas × valor/hora de cada pessoa.')
    expect(text('reviewRetro')).toBe(
      'Planning, review e retro entram na Agenda no ritmo das sprints.',
    )
    expect(text('checkins')).toBe('Mantém o quadro em dia pela bandeja, sem reunião diária.')
  })

  it('o motivo da Estimativa muda quando não há sprints ou não há controle de horas', () => {
    const withoutControl = recommendPreset({ ...DESIGN_EXAMPLE, controlsHoursAndCost: 'no' })
    expect(withoutControl.reasons.find((r) => r.moduleId === 'estimates.hours')?.text).toBe(
      'As sprints usam horas para a capacidade, então cada tarefa ganha uma estimativa.',
    )
    const tradicional = recommendPreset({ workType: 'finite', fixedDate: 'yes', scope: 'defined' })
    expect(tradicional.reasons.find((r) => r.moduleId === 'estimates.hours')?.text).toBe(
      'Cada tarefa ganha uma estimativa de horas para planejar o prazo.',
    )
  })

  it('o motivo de Sprints no Híbrido fala da data fixa', () => {
    const result = recommendPreset(ANSWERS_BY_PRESET.hibrido)
    expect(result.reasons.find((r) => r.moduleId === 'sprints')?.text).toBe(
      'Ciclos curtos com meta para tratar os detalhes que mudam dentro da data fixa.',
    )
  })

  it('todo módulo ligado, exceto núcleo, tem um motivo não vazio', () => {
    const matrix: WizardAnswers[] = [
      {},
      { workType: 'continuous' },
      {
        workType: 'finite',
        fixedDate: 'yes',
        scope: 'defined',
        experience: 'always',
        outsiderFollows: 'yes',
        controlsHoursAndCost: 'yes',
      },
      {
        workType: 'finite',
        fixedDate: 'yes',
        scope: 'partly',
        experience: 'sometimes',
        controlsHoursAndCost: 'yes',
      },
      {
        workType: 'finite',
        fixedDate: 'no',
        scope: 'defined',
        experience: 'always',
        outsiderFollows: 'yes',
      },
    ]
    for (const answers of matrix) {
      const result = recommendPreset(answers)
      const expected = result.modules.filter((id) => id !== 'core')
      expect(result.reasons.map((r) => r.moduleId)).toEqual(expected)
      for (const reason of result.reasons) {
        expect(reason.text.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('resultado é válido: reaplicar os módulos não puxa nenhum outro', () => {
    const workTypes: WizardAnswers['workType'][] = [undefined, 'finite', 'continuous', 'unknown']
    const fixedDates: WizardAnswers['fixedDate'][] = [undefined, 'yes', 'no', 'unknown']
    const scopes: WizardAnswers['scope'][] = [
      undefined,
      'defined',
      'partly',
      'will_change',
      'unknown',
    ]
    const outsiders: WizardAnswers['outsiderFollows'][] = [undefined, 'yes', 'no']
    const controls: WizardAnswers['controlsHoursAndCost'][] = [undefined, 'yes', 'no']
    const experiences: WizardAnswers['experience'][] = [undefined, 'never', 'sometimes', 'always']

    for (const workType of workTypes) {
      for (const fixedDate of fixedDates) {
        for (const scope of scopes) {
          for (const outsiderFollows of outsiders) {
            for (const controlsHoursAndCost of controls) {
              for (const experience of experiences) {
                const answers = definedOnly({
                  workType,
                  fixedDate,
                  scope,
                  outsiderFollows,
                  controlsHoursAndCost,
                  experience,
                })
                const result = recommendPreset(answers)
                const again = resolveModuleSet([], { enable: result.modules })
                expect(again.ok && again.autoEnabled, JSON.stringify(answers)).toEqual([])
                expect(result.modules).toContain('core')
              }
            }
          }
        }
      }
    }
  })

  it('é determinística: mesma entrada, mesma saída', () => {
    const answers: WizardAnswers = {
      workType: 'finite',
      fixedDate: 'yes',
      scope: 'will_change',
      outsiderFollows: 'yes',
      controlsHoursAndCost: 'yes',
      experience: 'sometimes',
    }
    expect(recommendPreset(answers)).toEqual(recommendPreset({ ...answers }))
  })
})

describe('recommendationSummary (resumo do design)', () => {
  it('exemplo do design: a frase exata de Recomendacao.dc.html', () => {
    expect(recommendationSummary(DESIGN_EXAMPLE, 'agil')).toBe(
      'Trabalho com começo e fim, sem data fixa e com entrega que vai mudar. Ciclos curtos deixam a equipe ajustar o rumo a cada duas semanas.',
    )
  })

  it('trabalho contínuo e data fixa com escopo definido', () => {
    expect(recommendationSummary({ workType: 'continuous' }, 'kanban')).toBe(
      'Trabalho sem começo e fim. O quadro mostra o fluxo do dia a dia, e o limite de tarefas em andamento evita gargalos.',
    )
    expect(
      recommendationSummary(
        { workType: 'finite', fixedDate: 'yes', scope: 'defined' },
        'tradicional',
      ),
    ).toBe(
      'Trabalho com começo e fim, com data fixa e com escopo definido. Marcos e cronograma mostram o caminho até a data final, passo a passo.',
    )
  })

  it('escopo parcial usa a frase de parte do escopo', () => {
    expect(
      recommendationSummary({ workType: 'finite', fixedDate: 'yes', scope: 'partly' }, 'hibrido'),
    ).toBe(
      'Trabalho com começo e fim, com data fixa e com parte do escopo definida. Os marcos seguram a data, e as partes que mudam andam em sprints curtas.',
    )
  })

  it('pulou tudo: só o fechamento do preset', () => {
    expect(recommendationSummary({}, 'simples')).toBe(
      'Nada para configurar agora: o projeto começa simples e você ajusta depois.',
    )
  })

  it('"não sei" não entra na frase', () => {
    expect(
      recommendationSummary({ workType: 'finite', fixedDate: 'unknown', scope: 'unknown' }, 'agil'),
    ).toBe(
      'Trabalho com começo e fim. Ciclos curtos deixam a equipe ajustar o rumo a cada duas semanas.',
    )
  })

  it('cada preset tem fechamento próprio', () => {
    const closings = PRESET_KEYS.map((key) => recommendationSummary({}, key))
    expect(new Set(closings).size).toBe(PRESET_KEYS.length)
  })
})

describe('recommendationNote (nota do design)', () => {
  it('exemplo do design: extras de Scrum e "Os outros 7 ficam em Módulos."', () => {
    expect(
      recommendationNote({
        preset: 'agil',
        hiddenExtras: ['definitionOfDone', 'burndown'],
        others: 7,
      }),
    ).toBe(
      'Critério de pronto e Burndown entram quando a equipe já trabalha com Scrum. Os outros 7 ficam em Módulos.',
    )
  })

  it('um extra e um outro módulo usam singular', () => {
    expect(recommendationNote({ preset: 'agil', hiddenExtras: ['burndown'], others: 1 })).toBe(
      'Burndown entra quando a equipe já trabalha com Scrum. O outro módulo fica em Módulos.',
    )
  })

  it('sem extras, só a contagem; sem nada, nulo', () => {
    expect(recommendationNote({ preset: 'agil', hiddenExtras: [], others: 3 })).toBe(
      'Os outros 3 ficam em Módulos.',
    )
    expect(recommendationNote({ preset: 'agil', hiddenExtras: [], others: 0 })).toBeNull()
  })

  it('preset sem método usa a frase de equipe que já organizou projetos', () => {
    expect(recommendationNote({ preset: 'simples', hiddenExtras: ['checkins'], others: 0 })).toBe(
      'Atualização diária entra quando a equipe já organizou projetos assim.',
    )
  })
})
