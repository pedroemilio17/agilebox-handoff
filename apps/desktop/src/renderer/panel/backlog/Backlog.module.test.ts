import { describe, expect, it } from 'vitest'
import backlogCss from './Backlog.module.css?raw'

/** Corpo da regra de um seletor de classe no nível de topo (ex.: `.chip {`). */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(source)
  return match?.[1] ?? ''
}

describe('alvos de toque do backlog', () => {
  it('o chip de projeto tem pelo menos 44px (token --size-touch-target)', () => {
    const body = ruleBody(backlogCss, '.chip')
    expect(body).toMatch(/min-height:\s*var\(--size-touch-target\)/)
    expect(body).not.toMatch(/(^|[\s;])height:\s*32px/)
  })
})
