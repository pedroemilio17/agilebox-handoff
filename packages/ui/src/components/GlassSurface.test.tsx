import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GlassSurface } from './GlassSurface'

afterEach(cleanup)

describe('GlassSurface', () => {
  it('renderiza conteúdo na variante solicitada', () => {
    render(
      <GlassSurface variant="popover" data-testid="surface">
        Conteúdo
      </GlassSurface>,
    )
    expect(screen.getByTestId('surface').getAttribute('data-variant')).toBe('popover')
    expect(screen.getByText('Conteúdo')).toBeTruthy()
  })
})
