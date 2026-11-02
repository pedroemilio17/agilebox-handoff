import { describe, expect, it } from 'vitest'
import { toOrganizationId, ValidationError } from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { AppDeps } from '../deps'
import { InMemoryUnitOfWork } from '../testing/fakes/in-memory-unit-of-work'
import { requireModuleAccess } from './guard'

const organizationId = toOrganizationId('00000000000000000000000001')

function depsWithoutStoredModules(): AppDeps {
  return { unitOfWork: new InMemoryUnitOfWork() } as unknown as AppDeps
}

describe('guard de módulo', () => {
  it('recusa id fora do catálogo como módulo desativado, para novos itens e para os existentes', async () => {
    // Id vindo de fora do tipo (IPC ou chamada futura): não existe no catálogo, então conta como desativado.
    const unknown = 'modulo-inexistente' as ModuleId
    const deps = depsWithoutStoredModules()

    await expect(requireModuleAccess(deps, organizationId, unknown, 'new')).rejects.toThrow(
      ValidationError,
    )
    await expect(requireModuleAccess(deps, organizationId, unknown, 'existing')).rejects.toThrow(
      'desativado',
    )
  })
})
