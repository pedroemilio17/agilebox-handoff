import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecommendationScreen, type RecommendationScreenProps } from './RecommendationScreen'
import type { WizardDraft } from './wizard-steps'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const CICLOS_DRAFT: WizardDraft = {
  deliveryMode: 'ciclos',
  externalVisibility: 'nao',
  experience: 'Intermediário',
}

function setup(overrides: Partial<RecommendationScreenProps> = {}) {
  const user = userEvent.setup()
  const props: RecommendationScreenProps = {
    name: 'App de Chamados',
    draft: CICLOS_DRAFT,
    onBack: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  }
  render(<RecommendationScreen {...props} />)
  return { user, props }
}

const switchOf = (label: string) => screen.getByRole<HTMLButtonElement>('switch', { name: label })
const status = () => screen.getByRole('status')

describe('RecommendationScreen (passo 3 do novo-projeto.html)', () => {
  it('mostra revisão final, nome, resumo do Kan, formato sugerido e lista limpa de recursos', () => {
    setup()

    expect(screen.getByText('Revisão final')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'App de Chamados' })).toBeTruthy()
    expect(
      screen.getByText(
        'Apoio do Kan configurado para perfil Intermediário · uso interno da equipe.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('Ciclos Ágeis (Sprints)')).toBeTruthy()
    expect(
      screen.getByText(
        '✓ Você pode ligar ou desligar recursos depois em Config. e Ferramentas sem perder dados.',
      ),
    ).toBeTruthy()

    const coreSwitch = switchOf('Desligar Quadro nos 5 estados')
    expect(coreSwitch.disabled).toBe(true)
    expect(coreSwitch.getAttribute('aria-checked')).toBe('true')

    expect(switchOf('Desligar Backlog').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Desligar Sprints (Ciclos curtos)').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Ligar Limite simultâneo no Quadro').getAttribute('aria-checked')).toBe('false')
  })

  it('desligar Backlog desliga Sprints junto e avisa', async () => {
    const { user } = setup()

    await user.click(switchOf('Desligar Backlog'))

    expect(status().textContent).toContain('Desligar Backlog também desliga Sprints')
    expect(switchOf('Ligar Backlog').getAttribute('aria-checked')).toBe('false')
    expect(switchOf('Ligar Sprints (Ciclos curtos)').getAttribute('aria-checked')).toBe('false')
  })

  it('ligar Sprints sozinho puxa Backlog e avisa', async () => {
    const { user } = setup()
    await user.click(switchOf('Desligar Backlog'))

    await user.click(switchOf('Ligar Sprints (Ciclos curtos)'))

    expect(status().textContent).toBe('Sprints (Ciclos curtos) precisa de Backlog. Ligado junto.')
    expect(switchOf('Desligar Backlog').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Desligar Sprints (Ciclos curtos)').getAttribute('aria-checked')).toBe('true')
  })

  it('Criar entrega payload com módulos sem núcleo, preset, guideLevel e answers', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: 'Criar projeto e ir ao Quadro' }))

    expect(props.onCreate).toHaveBeenCalledWith({
      modules: ['backlog', 'sprints', 'checkins', 'definitionOfDone'],
      startedFromPreset: 'agil',
      guideLevel: 'sometimes',
      answers: {
        workType: 'finite',
        fixedDate: 'no',
        scope: 'will_change',
        outsiderFollows: 'no',
        experience: 'sometimes',
      },
    })
  })

  it('submitting desabilita Criar', () => {
    setup({ submitting: true })
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Criar projeto e ir ao Quadro' })
        .disabled,
    ).toBe(true)
  })

  it('erro aparece em role=alert', () => {
    setup({ error: 'Não foi possível criar o projeto.' })
    expect(
      within(screen.getByRole('alert')).getByText('Não foi possível criar o projeto.'),
    ).toBeTruthy()
  })

  it('o rodapé volta às perguntas', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: '← Voltar às perguntas' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })
})
