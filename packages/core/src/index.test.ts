import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('API pública do core', () => {
  it('expõe valores, entidades, políticas, regras e erros', () => {
    expect(core.parseTaskStatus('todo')).toBe('todo')
    expect(core.createOrganization).toBeTypeOf('function')
    expect(core.canEditTask).toBeTypeOf('function')
    expect(core.diffTask).toBeTypeOf('function')
    expect(core.ValidationError).toBeTypeOf('function')
    expect(core.toTaskId).toBeTypeOf('function')
  })
})
