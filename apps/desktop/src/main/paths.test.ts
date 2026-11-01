import { describe, expect, it } from 'vitest'
import { getDatabasePath } from './paths.js'

describe('caminhos do aplicativo', () => {
  it('guarda o banco na pasta AgileBox dos dados do usuário', () => {
    expect(getDatabasePath('/dados/usuario')).toBe('/dados/usuario/AgileBox/agilebox.sqlite')
  })
})
