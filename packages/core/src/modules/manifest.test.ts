import { describe, expect, it } from 'vitest'
import { GUIDE_EVENT_TYPES, getManifest, listManifests, MODULE_MANIFESTS } from './manifest'
import { findDependencyCycle, getModule, MODULE_IDS, MODULE_REGISTRY } from './registry'

describe('manifestos de módulo (ADR-10, regra 4)', () => {
  it('todo módulo registrado tem manifesto, e só eles', () => {
    expect(Object.keys(MODULE_MANIFESTS).sort()).toEqual([...MODULE_IDS].sort())
    expect(listManifests().map((m) => m.id)).toEqual([...MODULE_IDS])
  })

  it.each(MODULE_IDS.map((id) => [id] as const))('%s tem o manifesto completo', (id) => {
    const manifest = getManifest(id)
    expect(manifest.name.trim()).not.toBe('')
    expect(manifest.objective.trim()).not.toBe('')
    expect(manifest.tutorial.why.trim()).not.toBe('')
    expect(manifest.tutorial.next.trim()).not.toBe('')
    expect(manifest.emptyState.short.trim()).not.toBe('')
    expect(manifest.emptyState.full.trim()).not.toBe('')
    for (const step of manifest.steps) {
      expect(step.title.trim()).not.toBe('')
      expect(step.why.trim()).not.toBe('')
      expect(GUIDE_EVENT_TYPES).toContain(step.doneWhen)
    }
  })

  it('só o núcleo não tem nível', () => {
    expect(
      listManifests()
        .filter((m) => m.level === null)
        .map((m) => m.id),
    ).toEqual(['core'])
  })

  it('níveis do design (N1, N2, N3)', () => {
    const levels = Object.fromEntries(listManifests().map((m) => [m.id, m.level]))
    expect(levels).toMatchObject({
      checkins: 1,
      backlog: 1,
      'estimates.hours': 1,
      cost: 1,
      milestones: 1,
      wbs: 2,
      schedule: 2,
      sprints: 2,
      wip: 2,
      definitionOfDone: 2,
      reviewRetro: 2,
      burndown: 2,
      flowMetrics: 3,
      baseline: 3,
      risks: 3,
    })
  })

  it('o manifesto lê as dependências duras do catálogo, sem copiar', () => {
    for (const manifest of listManifests()) {
      expect(manifest.requires).toEqual(getModule(manifest.id).requires)
    }
  })

  it('dependência suave aponta para módulo registrado, não repete a dura e não é o próprio', () => {
    for (const manifest of listManifests()) {
      for (const soft of manifest.enhances) {
        expect(MODULE_IDS, `${manifest.id} aproveita ${soft}`).toContain(soft)
        expect(soft).not.toBe(manifest.id)
        expect(manifest.requires).not.toContain(soft)
      }
    }
  })

  it('o grafo de dependências duras não tem ciclos', () => {
    expect(findDependencyCycle(MODULE_REGISTRY)).toBeNull()
  })

  it('as chaves dos passos são únicas no catálogo inteiro', () => {
    const keys = listManifests().flatMap((m) => m.steps.map((s) => s.key))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('as dependências do catálogo seguem o ADR-10', () => {
    expect(getModule('sprints').requires).toEqual(['backlog'])
    expect(getModule('cost').requires).toEqual(['estimates.hours'])
    expect(getModule('baseline').requires).toEqual(['schedule'])
    expect(getModule('milestones').requires).toEqual(['core'])
    expect(getModule('wbs').requires).toEqual(['core'])
  })

  it('sprints: sprint ativa agenda o desligamento; sem sprint ativa pode desligar', () => {
    expect(getManifest('sprints').canDisable({ hasActiveSprint: true })).toEqual({
      ok: false,
      block: { reason: 'active_sprint', scheduleAtEnd: true },
    })
    expect(getManifest('sprints').canDisable({ hasActiveSprint: false })).toEqual({ ok: true })
    expect(getManifest('backlog').canDisable({ hasActiveSprint: true })).toEqual({ ok: true })
  })
})
