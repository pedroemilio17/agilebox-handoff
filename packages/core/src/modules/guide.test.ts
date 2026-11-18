import { describe, expect, it } from 'vitest'
import {
  buildGuideTrail,
  completeStepsOnEvent,
  guideIntensity,
  guideProgress,
  isWelcomeDue,
  resolveGuideExperience,
} from './guide'
import type { GuideTrailStep } from './guide'
import { GUIDE_EVENT_TYPES } from './manifest'
import { PROJECT_PRESETS, projectPresetModules } from './project-presets'
import { MODULE_IDS } from './registry'
import type { UserId } from '../shared/ids'
import type { ModuleId } from './registry'

const agilTrail = () => buildGuideTrail(projectPresetModules('agil', { experienced: false }))

function indexOfKey(trail: readonly GuideTrailStep[], key: string): number {
  const index = trail.findIndex((step) => step.key === key)
  expect(index, `passo ${key} na trilha`).toBeGreaterThanOrEqual(0)
  return index
}

describe('trilha do guia (ADR-10)', () => {
  it('só-núcleo gera trilha vazia', () => {
    expect(buildGuideTrail(['core'])).toEqual([])
    expect(buildGuideTrail([])).toEqual([])
  })

  it('módulo ligado sem passos não aparece', () => {
    expect(buildGuideTrail(['core', 'cost'])).toEqual([])
    expect(buildGuideTrail(['core', 'wip', 'definitionOfDone'])).toEqual([])
  })

  it('Ágil: backlog antes de sprints, sprints antes de cerimônias, passos do backlog na ordem do manifesto', () => {
    const trail = agilTrail()
    const backlogList = indexOfKey(trail, 'backlog.list')
    const backlogRank = indexOfKey(trail, 'backlog.rank')
    const sprintsCreate = indexOfKey(trail, 'sprints.create')
    const sprintsAdd = indexOfKey(trail, 'sprints.add')
    const planning = indexOfKey(trail, 'ceremonies.planning')

    expect(backlogList).toBeLessThan(backlogRank)
    expect(backlogRank).toBeLessThan(sprintsCreate)
    expect(sprintsCreate).toBeLessThan(sprintsAdd)
    expect(sprintsAdd).toBeLessThan(planning)
  })

  it('cada passo traz o módulo, o nome dele e o título do passo seguinte', () => {
    const trail = agilTrail()
    const backlogList = trail[indexOfKey(trail, 'backlog.list')]
    expect(backlogList).toMatchObject({
      moduleId: 'backlog',
      moduleName: 'Backlog',
      title: 'Liste o que precisa ser feito',
      doneWhen: 'task.created',
    })
  })

  it('é determinística: a ordem da entrada não muda o resultado', () => {
    const forward = buildGuideTrail(['checkins', 'estimates.hours', 'backlog', 'sprints'])
    const reverse = buildGuideTrail(['sprints', 'backlog', 'estimates.hours', 'checkins'])
    expect(reverse).toEqual(forward)
    expect(buildGuideTrail(['sprints', 'backlog'])).toEqual(buildGuideTrail(['backlog', 'sprints']))
  })

  it('empate entre módulos sem dependência segue a ordem do catálogo', () => {
    const trail = buildGuideTrail(['checkins', 'estimates.hours'])
    expect(trail.map((step) => step.moduleId)).toEqual(['checkins', 'estimates.hours'])
    expect(MODULE_IDS.indexOf('checkins')).toBeLessThan(MODULE_IDS.indexOf('estimates.hours'))
  })

  it('ids fora do catálogo são ignorados', () => {
    const withUnknown = buildGuideTrail(['nao-existe' as ModuleId, 'backlog'])
    expect(withUnknown).toEqual(buildGuideTrail(['backlog']))
    expect(withUnknown.length).toBeGreaterThan(0)
  })

  it('next encadeia os títulos e é null no último passo', () => {
    const trail = agilTrail()
    expect(trail.length).toBeGreaterThan(1)
    trail.forEach((step, index) => {
      expect(step.next).toBe(trail[index + 1]?.title ?? null)
    })
    expect(trail[trail.length - 1]?.next).toBeNull()
  })
})

describe('progresso da trilha', () => {
  it('sem nada concluído, o atual é o primeiro passo', () => {
    const trail = agilTrail()
    expect(guideProgress(trail, new Set())).toEqual({
      done: 0,
      total: trail.length,
      current: trail[0],
    })
  })

  it('conclusão fora de ordem conta, e o atual é o primeiro pendente', () => {
    const trail = agilTrail()
    const progress = guideProgress(trail, new Set(['sprints.add']))
    expect(progress.done).toBe(1)
    expect(progress.current).toBe(trail[0])
  })

  it('o atual avança para o primeiro pendente depois dos concluídos', () => {
    const trail = agilTrail()
    const keys = new Set([trail[0]!.key, trail[1]!.key])
    const progress = guideProgress(trail, keys)
    expect(progress.done).toBe(2)
    expect(progress.current).toBe(trail[2])
  })

  it('tudo concluído: current é null; chaves fora da trilha não contam', () => {
    const trail = agilTrail()
    const all = new Set([...trail.map((step) => step.key), 'chave.de.outro.projeto'])
    expect(guideProgress(trail, all)).toEqual({
      done: trail.length,
      total: trail.length,
      current: null,
    })
  })

  it('trilha vazia: total 0 e current null', () => {
    expect(guideProgress([], new Set(['x']))).toEqual({ done: 0, total: 0, current: null })
  })
})

describe('conclusão pelo evento', () => {
  it('devolve só os passos pendentes com esse evento', () => {
    const trail = agilTrail()
    expect(completeStepsOnEvent(trail, new Set(), 'task.created')).toEqual(['backlog.list'])
    expect(completeStepsOnEvent(trail, new Set(['backlog.list']), 'task.created')).toEqual([])
  })

  it('evento sem passo correspondente não conclui nada', () => {
    expect(completeStepsOnEvent(agilTrail(), new Set(), 'milestone.created')).toEqual([])
  })

  it('todos os pendentes com o mesmo evento concluem juntos, na ordem da trilha', () => {
    const step = (key: string, doneWhen: GuideTrailStep['doneWhen']): GuideTrailStep => ({
      key,
      title: key,
      why: key,
      doneWhen,
      moduleId: 'backlog',
      moduleName: 'Backlog',
      next: null,
    })
    const trail = [
      step('a', 'task.created'),
      step('b', 'daily.answered'),
      step('c', 'task.created'),
      step('d', 'task.created'),
    ]
    expect(completeStepsOnEvent(trail, new Set(['c']), 'task.created')).toEqual(['a', 'd'])
  })
})

describe('intensidade do guia', () => {
  it('nunca: cartão aberto, estado vazio completo, dicas e jargão ligados', () => {
    expect(guideIntensity('never')).toEqual({
      firstStepsCard: 'open',
      emptyState: 'full',
      firstTimeHints: true,
      explainJargon: true,
    })
  })

  it('às vezes: cartão recolhido, estado vazio curto, sem dicas nem jargão', () => {
    expect(guideIntensity('sometimes')).toEqual({
      firstStepsCard: 'collapsed',
      emptyState: 'short',
      firstTimeHints: false,
      explainJargon: false,
    })
  })

  it('sempre: cartão oculto, estado vazio curto, sem dicas nem jargão', () => {
    expect(guideIntensity('always')).toEqual({
      firstStepsCard: 'hidden',
      emptyState: 'short',
      firstTimeHints: false,
      explainJargon: false,
    })
  })

  it('projeto prevalece sobre a pessoa, que vale sobre o padrão', () => {
    expect(resolveGuideExperience('always', 'never')).toBe('always')
    expect(resolveGuideExperience('never', 'always')).toBe('never')
    expect(resolveGuideExperience('sometimes', null)).toBe('sometimes')
    expect(resolveGuideExperience(undefined, 'always')).toBe('always')
    expect(resolveGuideExperience(null, undefined)).toBe('never')
    expect(resolveGuideExperience(undefined, undefined)).toBe('never')
  })
})

describe('presets de projeto geram trilhas válidas', () => {
  const cases = PROJECT_PRESETS.flatMap((preset) =>
    [false, true].map((experienced) => [preset.key, experienced] as const),
  )

  it.each(cases)('%s (experiente: %s): chaves únicas e doneWhen conhecido', (key, experienced) => {
    const trail = buildGuideTrail(projectPresetModules(key, { experienced }))
    const keys = trail.map((step) => step.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const step of trail) {
      expect(GUIDE_EVENT_TYPES).toContain(step.doneWhen)
    }
  })
})

describe('isWelcomeDue (janela de boas-vindas, ADR-10)', () => {
  const CREATOR = 'creator' as UserId
  const PERSON = 'person' as UserId
  const CREATED = '2026-11-16T10:00:00.000Z'
  const LATER = '2026-11-16T11:00:00.000Z'
  const base = {
    actorUserId: PERSON,
    project: { createdBy: CREATOR, createdAt: CREATED },
    member: { addedAt: LATER },
    trailSteps: 3,
    answered: false,
  }

  it('vale quando todas as condições valem', () => {
    expect(isWelcomeDue(base)).toBe(true)
  })

  it('não vale para quem não é membro', () => {
    expect(isWelcomeDue({ ...base, member: null })).toBe(false)
  })

  it('não vale para quem criou o projeto', () => {
    expect(isWelcomeDue({ ...base, actorUserId: CREATOR })).toBe(false)
  })

  it('não vale para quem entrou no mesmo instante da criação, nem antes', () => {
    expect(isWelcomeDue({ ...base, member: { addedAt: CREATED } })).toBe(false)
    expect(isWelcomeDue({ ...base, member: { addedAt: '2026-11-16T09:00:00.000Z' } })).toBe(false)
  })

  it('não vale com trilha vazia', () => {
    expect(isWelcomeDue({ ...base, trailSteps: 0 })).toBe(false)
  })

  it('não vale depois de respondida', () => {
    expect(isWelcomeDue({ ...base, answered: true })).toBe(false)
  })
})
