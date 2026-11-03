import { describe, expect, it } from 'vitest'
import detailCss from './TaskDetailView.module.css?raw'

/** Corpo da regra de um seletor de classe no nível de topo (ex.: `.numberInput {`). */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(source)
  return match?.[1] ?? ''
}

describe('alvos de toque do detalhe', () => {
  it('o campo numérico (estimativa e custo) tem pelo menos 44px', () => {
    const body = ruleBody(detailCss, '.numberInput')
    expect(body).toMatch(/min-height:\s*var\(--size-touch-target\)/)
    expect(body).not.toMatch(/min-height:\s*36px/)
  })
})
