import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDatabasePath, getMigrationsFolder } from './paths'

describe('caminhos do app', () => {
  it('guarda o banco na pasta de dados do usuário', () => {
    expect(getDatabasePath('/dados')).toBe(join('/dados', 'AgileBox', 'agilebox.sqlite'))
  })

  it('usa as migrações dos recursos só quando empacotado', () => {
    expect(getMigrationsFolder(true, '/app/resources')).toBe(join('/app/resources', 'migrations'))
    expect(getMigrationsFolder(false, '/app/resources')).toBeUndefined()
  })
})
