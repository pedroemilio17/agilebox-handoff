import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { MyRateSection } from './MyRateSection'

const ME = '01HZANA000000000000000000B'
const ORG = '01HZTEAM00000000000000000C'

afterEach(cleanup)

function setup({
  defaultRate = 120,
  saveError = false,
}: { defaultRate?: number | null; saveError?: boolean } = {}) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: ME,
    organizationId: ORG,
    role: 'collaborator',
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([
    { id: ME, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate },
  ])
  const save = saveError
    ? vi.spyOn(api.users, 'setDefaultRate').mockRejectedValue(new Error('falhou'))
    : vi.spyOn(api.users, 'setDefaultRate').mockResolvedValue({
        id: ME,
        name: 'Ana Souza',
        email: 'ana@exemplo.com',
        initials: 'AS',
        role: 'collaborator',
        defaultRate: 150,
      })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <MyRateSection />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { save, user: userEvent.setup() }
}

describe('Ajustes · meu valor/hora padrão (privado)', () => {
  it('mostra o próprio valor/hora atual no campo, com a nota de privacidade', async () => {
    setup()
    const input = await screen.findByDisplayValue('120')
    expect(screen.getByLabelText('Meu valor por hora em reais')).toBe(input)
    expect(screen.getByText('Privado: apenas você e o Gestor visualizam este valor.')).toBeTruthy()
  })

  it('salva em centavos pelo caso de uso do próprio usuário e confirma', async () => {
    const { save, user } = setup()
    // Espera o valor atual chegar: o campo fica desabilitado até a sessão carregar.
    const input = await screen.findByDisplayValue('120')
    await user.clear(input)
    await user.type(input, '150')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(save).toHaveBeenCalledWith({ userId: ME, rateCents: 15000 })
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText('Valor salvo.')).toBeTruthy()
  })

  it('valor zero não envia nada e mostra o aviso', async () => {
    const { save, user } = setup()
    // Espera o valor atual chegar: o campo fica desabilitado até a sessão carregar.
    const input = await screen.findByDisplayValue('120')
    await user.clear(input)
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Informe um valor maior que zero.')
  })

  it('falha ao salvar mostra o erro em pt-BR', async () => {
    const { user } = setup({ saveError: true })
    // Espera o valor atual chegar: o campo fica desabilitado até a sessão carregar.
    const input = await screen.findByDisplayValue('120')
    await user.clear(input)
    await user.type(input, '90')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível salvar o valor.')
  })
})
