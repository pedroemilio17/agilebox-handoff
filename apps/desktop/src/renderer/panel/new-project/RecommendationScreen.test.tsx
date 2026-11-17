import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WizardAnswers } from '@agilebox/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecommendationScreen, type RecommendationScreenProps } from './RecommendationScreen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const AGIL_ANSWERS: WizardAnswers = {
  workType: 'finite',
  fixedDate: 'no',
  scope: 'will_change',
  controlsHoursAndCost: 'yes',
}

function setup(overrides: Partial<RecommendationScreenProps> = {}) {
  const user = userEvent.setup()
  const props = {
    name: 'App de Chamados',
    answers: AGIL_ANSWERS,
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  }
  render(<RecommendationScreen {...props} />)
  return { user, props }
}

const switchOf = (label: string) => screen.getByRole('switch', { name: label })
const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) })
const status = () => screen.getByRole('status')

describe('RecommendationScreen', () => {
  it('abre no preset recomendado, com os módulos e os motivos visíveis', () => {
    setup()

    expect(screen.getByRole('heading', { name: 'Ágil (Scrum)' })).toBeTruthy()
    expect(chip('Ágil').getAttribute('aria-pressed')).toBe('true')
    expect(chip('Ágil').textContent).toContain('recomendado')
    expect(document.activeElement).toBe(chip('Ágil'))

    for (const name of [
      'Backlog',
      'Sprints',
      'Estimativa em horas',
      'Custo',
      'Cerimônias',
      'Atualização diária',
    ]) {
      expect(switchOf(`Desligar ${name}`).getAttribute('aria-checked')).toBe('true')
    }
    expect(
      screen.getByText(
        'Backlog ligado porque é preciso guardar e ordenar o que ainda não entrou em sprint',
      ),
    ).toBeTruthy()
    expect(screen.getByText(/Custo ligado porque você controla horas e custo/)).toBeTruthy()
  })

  it('trocar o chip para Tradicional troca a lista de módulos', async () => {
    const { user } = setup()

    await user.click(chip('Tradicional'))

    expect(chip('Tradicional').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('switch', { name: 'Desligar Sprints' })).toBeNull()
    expect(switchOf('Desligar Entregas (EAP)').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Desligar Cronograma')).toBeTruthy()
  })

  it('desligar Backlog avisa que Sprints sai junto', async () => {
    const { user } = setup()

    await user.click(switchOf('Desligar Backlog'))

    expect(status().textContent).toContain('Desligar Backlog também desliga Sprints')
    expect(switchOf('Ligar Backlog').getAttribute('aria-checked')).toBe('false')
    expect(switchOf('Ligar Sprints').getAttribute('aria-checked')).toBe('false')
  })

  it('ligar Sprints sozinho avisa que Backlog entra', async () => {
    const { user } = setup()
    await user.click(switchOf('Desligar Backlog'))

    await user.click(switchOf('Ligar Sprints'))

    expect(status().textContent).toBe('Sprints precisa de Backlog. Ligamos os dois.')
    expect(switchOf('Desligar Backlog').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Desligar Sprints').getAttribute('aria-checked')).toBe('true')
  })

  it('o núcleo nunca aparece como desligável', () => {
    setup()
    expect(screen.queryByRole('switch', { name: /Núcleo/ })).toBeNull()
    expect(screen.queryByText('Núcleo')).toBeNull()
  })

  it('experiência muda os bullets do guia', async () => {
    const { user } = setup()
    expect(screen.getByText('Primeiros passos abertos')).toBeTruthy()

    await user.click(screen.getByRole('radio', { name: 'Sempre' }))

    expect(screen.getByText('Primeiros passos ocultos, abrem pelo ?')).toBeTruthy()
    expect(screen.getByText('Sem dicas de primeira vez')).toBeTruthy()
    expect(screen.queryByText('Primeiros passos abertos')).toBeNull()
  })

  it('a pergunta 6 cita o preset escolhido', async () => {
    const { user } = setup()
    expect(screen.getByRole('group', { name: 'A equipe já trabalhou com Scrum?' })).toBeTruthy()

    await user.click(chip('Simples'))

    expect(
      screen.getByRole('group', { name: 'A equipe já organizou projetos assim?' }),
    ).toBeTruthy()
  })

  it('Criar entrega o payload com módulos sem núcleo, preset e respostas', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect(props.onCreate).toHaveBeenCalledWith({
      modules: [
        'agenda',
        'backlog',
        'sprints',
        'checkins',
        'estimates.hours',
        'reviewRetro',
        'cost',
      ],
      startedFromPreset: 'agil',
      guideLevel: 'never',
      answers: { ...AGIL_ANSWERS, experience: 'never' },
    })
  })

  it('submitting desabilita Criar', () => {
    setup({ submitting: true })
    expect(screen.getByRole('button', { name: 'Criar projeto' }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('erro aparece em role=alert', () => {
    setup({ error: 'Não foi possível criar o projeto.' })
    expect(
      within(screen.getByRole('alert')).getByText('Não foi possível criar o projeto.'),
    ).toBeTruthy()
  })

  it('Voltar chama onBack e Esc cancela', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })
})
