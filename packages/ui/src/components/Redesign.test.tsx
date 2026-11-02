import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'
import { BarChart, Sparkline } from './Charts'
import { MetricTile, SignalBadge, WipMeter } from './Indicators'

afterEach(cleanup)

describe('componentes v2', () => {
  it('preserva lacunas de semanas sem dados em vez de ligar os pontos através delas', () => {
    const { container } = render(
      <Sparkline
        label="Adesão"
        data={[
          { label: 'S1', value: 50 },
          { label: 'S2', value: null },
          { label: 'S3', value: 75 },
        ]}
      />,
    )
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('S2: sem dados')
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('permite sair do painel para o quadro e devolve o foco ao fechar com Esc', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir tarefa</button>
          <button>Outra tarefa</button>
          <Drawer open={open} title="Tarefa de exemplo" onClose={() => setOpen(false)}>
            <button>Editar</button>
          </Drawer>
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Abrir tarefa' })
    await user.click(opener)
    expect(screen.getByRole('dialog').hasAttribute('aria-modal')).toBe(false)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar' }))
    await user.tab()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('exibe zero e falta de dados sem inventar valores, e permite abrir o filtro', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(
      <MetricTile label="Paradas" value={0} caption="Esta semana" onClick={onClick} />,
    )
    expect(screen.getByText('0')).toBeTruthy()
    expect(screen.getByLabelText('Sem ocorrências')).toBeTruthy()
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
    rerender(
      <MetricTile label="Paradas" value={null} caption="Sem movimentação" onClick={onClick} />,
    )
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByLabelText('Sem ocorrências')).toBeNull()
  })

  it('expõe valores de gráficos e capacidade também por texto acessível', () => {
    const data = [
      { label: 'S44', value: 0 },
      { label: 'S45', value: 3 },
    ]
    render(
      <>
        <Sparkline label="Ciclo" data={data} />
        <BarChart label="Vazão" data={data} />
        <WipMeter count={4} capacity={3} />
        <SignalBadge variant="aging">Parada há 5 dias</SignalBadge>
      </>,
    )
    expect(screen.getByRole('img', { name: 'Ciclo: S44: 0; S45: 3' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Vazão: S44: 0; S45: 3' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '4 em andamento, capacidade de 3' })).toBeTruthy()
    expect(screen.getByText('Parada há 5 dias')).toBeTruthy()
  })

  it('não gera coordenadas inválidas quando não há dados ou todos os valores são zero', () => {
    const { container } = render(
      <>
        <Sparkline label="Semanas" data={[]} />
        <BarChart label="Semanas" data={[{ label: 'S45', value: 0 }]} />
      </>,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(screen.getByRole('img', { name: 'Semanas: sem dados' })).toBeTruthy()
  })
})
