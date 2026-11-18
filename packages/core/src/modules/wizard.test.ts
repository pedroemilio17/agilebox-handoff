import { describe, expect, it } from 'vitest'
import { PROJECT_PRESETS, getProjectPreset, projectPresetModules } from './project-presets'
import type { ProjectPresetKey } from './project-presets'
import { resolveModuleSet } from './resolve'
import { recommendPreset } from './wizard'
import type { WizardAnswers } from './wizard'

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
        'Marcos ligados porque quem está de fora acompanha o projeto',
      )
    },
  )

  it.each(PRESET_KEYS.map((key) => [key] as const))(
    'pergunta de horas e custo liga estimativas em horas e custo em %s',
    (key) => {
      const result = recommendPreset({ ...ANSWERS_BY_PRESET[key], controlsHoursAndCost: 'yes' })
      expect(result.modules).toEqual(expect.arrayContaining(['estimates.hours', 'cost']))
      expect(result.reasons.find((r) => r.moduleId === 'cost')?.text).toBe(
        'Custo ligado porque você controla horas e custo',
      )
    },
  )

  it.each(PRESET_KEYS.map((key) => [key] as const))(
    'experiência acrescenta os extras de %s; "nunca" e ausente não acrescentam',
    (key) => {
      const base = ANSWERS_BY_PRESET[key]
      const extras = getProjectPreset(key).experiencedExtras

      for (const experience of ['sometimes', 'always'] as const) {
        const result = recommendPreset({ ...base, experience })
        expect(result.guideLevel).toBe(experience)
        expect(result.modules).toEqual(projectPresetModules(key, { experienced: true }))
        expect(result.modules).toEqual(expect.arrayContaining([...extras]))
      }

      for (const answers of [{ ...base, experience: 'never' as const }, base]) {
        const result = recommendPreset(answers)
        expect(result.modules).toEqual(projectPresetModules(key, { experienced: false }))
      }
      expect(recommendPreset({ ...base, experience: 'never' }).guideLevel).toBe('never')
      expect(recommendPreset(base).guideLevel).toBe('never')
    },
  )

  it('motivo de dependência cita o módulo que precisa do outro', () => {
    // Ágil com experiência: cerimônias (Review e retro) exigem a Agenda, que não está no preset.
    const result = recommendPreset({ ...ANSWERS_BY_PRESET.agil })
    expect(result.modules).toContain('agenda')
    expect(result.reasons.find((r) => r.moduleId === 'agenda')?.text).toBe(
      'Agenda ligada porque Review e retro precisa dela',
    )
  })

  it('usa o texto da regra para cronograma', () => {
    const result = recommendPreset(ANSWERS_BY_PRESET.tradicional)
    expect(result.reasons.find((r) => r.moduleId === 'schedule')?.text).toBe(
      'Cronograma ligado porque há uma data final fixa',
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
