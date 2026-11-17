import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEAM_LEVEL,
  DEFAULT_TEAM_MODULE_IDS,
  toOrganizationId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { TeamToolsRepository } from '../ports'

/**
 * Ids fixos do contrato. Quem roda o contrato precisa criar, antes, as duas organizações e os
 * dois gestores (um por organização) no próprio armazenamento.
 */
export const teamToolsFixtures = {
  organizationA: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
  organizationB: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW'),
  managerA: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX'),
  managerB: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAY'),
} as const

const FIRST_CHANGE = '2026-11-16T10:00:00.000Z'
const SECOND_CHANGE = '2026-11-16T11:00:00.000Z'

/**
 * Contrato dos ajustes da equipe: vale para o fake em memória e para o SQLite. `makeRepository`
 * devolve um repositório vazio, com as organizações e os gestores de `teamToolsFixtures`.
 */
export function describeTeamToolsRepositoryContract(
  name: string,
  makeRepository: () => Promise<TeamToolsRepository>,
): void {
  const { organizationA, organizationB, managerA, managerB } = teamToolsFixtures

  describe(`contrato dos ajustes da equipe: ${name}`, () => {
    it('sem preferência gravada devolve o padrão de defaultTeamTools (nível Avançado)', async () => {
      const repository = await makeRepository()
      const settings = await repository.getSettings(organizationA)

      expect(settings.level).toBe(DEFAULT_TEAM_LEVEL)
      expect(settings.modules.map((module) => module.moduleId)).toEqual(DEFAULT_TEAM_MODULE_IDS)
      expect(settings.modules.every((module) => module.state === 'active')).toBe(true)
      expect(settings.modules.every((module) => module.changedBy === null)).toBe(true)
    })

    it('grava e lê de volta nível, estados e configuração; desligado continua guardado', async () => {
      const repository = await makeRepository()
      await repository.saveSettings(
        organizationA,
        {
          level: 'intermediate',
          modules: [
            { moduleId: 'burndown', state: 'disabled' },
            {
              moduleId: 'checkins',
              state: 'active',
              config: { horario: '09:00', dias: [1, 2, 3] },
            },
            { moduleId: 'sprints', state: 'winding_down' },
          ],
        },
        managerA,
        FIRST_CHANGE,
      )

      const settings = await repository.getSettings(organizationA)
      expect(settings.level).toBe('intermediate')
      const byId = new Map(settings.modules.map((module) => [module.moduleId, module]))
      expect(byId.get('burndown')).toMatchObject({
        state: 'disabled',
        changedBy: managerA,
        changedAt: FIRST_CHANGE,
      })
      expect(byId.get('checkins')?.config).toEqual({ horario: '09:00', dias: [1, 2, 3] })
      expect(byId.get('sprints')?.state).toBe('winding_down')
      // Linha não citada no pedido segue como estava: padrão, sem autoria.
      expect(byId.get('acceptance')).toMatchObject({ state: 'active', changedBy: null })
    })

    it('a auditoria registra quem mudou, quando, antes e depois, da mais recente para a mais antiga', async () => {
      const repository = await makeRepository()
      await repository.saveSettings(
        organizationA,
        {
          level: 'intermediate',
          modules: [{ moduleId: 'burndown', state: 'disabled' }],
        },
        managerA,
        FIRST_CHANGE,
      )
      await repository.saveSettings(
        organizationA,
        { level: 'intermediate', modules: [{ moduleId: 'burndown', state: 'active' }] },
        managerA,
        SECOND_CHANGE,
      )

      const audit = await repository.listAudit(organizationA, 10)
      expect(audit.map((entry) => [entry.kind, entry.moduleId, entry.before, entry.after])).toEqual(
        [
          ['module_state', 'burndown', 'disabled', 'active'],
          ['module_state', 'burndown', 'active', 'disabled'],
          ['level', null, 'advanced', 'intermediate'],
        ],
      )
      expect(audit[0]).toMatchObject({
        organizationId: organizationA,
        actorId: managerA,
        createdAt: SECOND_CHANGE,
      })
      expect(audit[2]).toMatchObject({ actorId: managerA, createdAt: FIRST_CHANGE })
      expect(await repository.listAudit(organizationA, 1)).toHaveLength(1)
    })

    it('aplicação de preset grava a auditoria do tipo preset, com o id do preset em after', async () => {
      const repository = await makeRepository()
      await repository.saveSettings(
        organizationA,
        { level: 'basic', modules: [{ moduleId: 'wip', state: 'disabled' }], preset: 'kanban' },
        managerA,
        FIRST_CHANGE,
      )

      const audit = await repository.listAudit(organizationA, 10)
      expect(audit.map((entry) => [entry.kind, entry.moduleId, entry.after])).toEqual(
        expect.arrayContaining([
          ['preset', null, 'kanban'],
          ['level', null, 'basic'],
          ['module_state', 'wip', 'disabled'],
        ]),
      )
      expect(audit.find((entry) => entry.kind === 'preset')).toMatchObject({
        actorId: managerA,
        createdAt: FIRST_CHANGE,
      })
    })

    it('mudar a configuração de um módulo grava auditoria de config com antes e depois; igual não grava', async () => {
      const repository = await makeRepository()
      await repository.saveSettings(
        organizationA,
        {
          level: 'advanced',
          modules: [{ moduleId: 'sprints', state: 'active', config: { maxActiveSprints: 2 } }],
        },
        managerA,
        FIRST_CHANGE,
      )
      await repository.saveSettings(
        organizationA,
        {
          level: 'advanced',
          modules: [{ moduleId: 'sprints', state: 'active', config: { maxActiveSprints: 3 } }],
        },
        managerA,
        SECOND_CHANGE,
      )
      await repository.saveSettings(
        organizationA,
        {
          level: 'advanced',
          modules: [{ moduleId: 'sprints', state: 'active', config: { maxActiveSprints: 3 } }],
        },
        managerA,
        '2026-11-16T12:00:00.000Z',
      )

      const audit = await repository.listAudit(organizationA, 10)
      expect(
        audit
          .filter((entry) => entry.kind === 'config')
          .map((entry) => [entry.moduleId, entry.before, entry.after, entry.actorId]),
      ).toEqual([
        ['sprints', '{"maxActiveSprints":2}', '{"maxActiveSprints":3}', managerA],
        ['sprints', null, '{"maxActiveSprints":2}', managerA],
      ])
      expect(audit.find((entry) => entry.kind === 'config')).toMatchObject({
        createdAt: SECOND_CHANGE,
      })
    })

    it('mudar só o estado de um módulo com configuração mantém a configuração gravada', async () => {
      const repository = await makeRepository()
      await repository.saveSettings(
        organizationA,
        {
          level: 'advanced',
          modules: [{ moduleId: 'sprints', state: 'active', config: { maxActiveSprints: 4 } }],
        },
        managerA,
        FIRST_CHANGE,
      )
      await repository.saveSettings(
        organizationA,
        { level: 'advanced', modules: [{ moduleId: 'sprints', state: 'winding_down' }] },
        managerA,
        SECOND_CHANGE,
      )

      const settings = await repository.getSettings(organizationA)
      expect(settings.modules.find((module) => module.moduleId === 'sprints')).toMatchObject({
        state: 'winding_down',
        config: { maxActiveSprints: 4 },
      })
      const audit = await repository.listAudit(organizationA, 10)
      expect(audit.filter((entry) => entry.kind === 'config')).toHaveLength(1)
    })

    it('recusa conjunto inválido e não grava nada, nem auditoria', async () => {
      const repository = await makeRepository()

      // Sprints (ativo) depende de Backlog: desligar Backlog deixa o conjunto inválido.
      await expect(
        repository.saveSettings(
          organizationA,
          { level: 'advanced', modules: [{ moduleId: 'backlog', state: 'disabled' }] },
          managerA,
          FIRST_CHANGE,
        ),
      ).rejects.toThrow(ValidationError)

      const settings = await repository.getSettings(organizationA)
      expect(settings.modules.find((module) => module.moduleId === 'backlog')?.state).toBe('active')
      expect(await repository.listAudit(organizationA, 10)).toEqual([])
    })

    it('recusa ator de outra organização e não grava nada', async () => {
      const repository = await makeRepository()

      await expect(
        repository.saveSettings(
          organizationA,
          { level: 'basic', modules: [{ moduleId: 'burndown', state: 'disabled' }] },
          managerB,
          FIRST_CHANGE,
        ),
      ).rejects.toThrow(ValidationError)

      expect((await repository.getSettings(organizationA)).level).toBe('advanced')
      expect(await repository.listAudit(organizationA, 10)).toEqual([])
    })

    it('isola organizações: a gravação de A não aparece em B nem na auditoria de B', async () => {
      const repository = await makeRepository()
      await repository.saveSettings(
        organizationA,
        { level: 'basic', modules: [{ moduleId: 'burndown', state: 'disabled' }] },
        managerA,
        FIRST_CHANGE,
      )

      const settingsB = await repository.getSettings(organizationB)
      expect(settingsB.level).toBe('advanced')
      expect(settingsB.modules.find((module) => module.moduleId === 'burndown')?.state).toBe(
        'active',
      )
      expect(await repository.listAudit(organizationB, 10)).toEqual([])
    })

    it('recusa limite de auditoria que não é inteiro positivo', async () => {
      const repository = await makeRepository()
      await expect(repository.listAudit(organizationA, 0)).rejects.toThrow(ValidationError)
      await expect(repository.listAudit(organizationA, 1.5)).rejects.toThrow(ValidationError)
    })
  })
}
