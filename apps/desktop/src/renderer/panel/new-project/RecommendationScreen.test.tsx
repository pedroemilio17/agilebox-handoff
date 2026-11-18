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
      'Estimativa',
      'Custo',
      'Cerimônias',
      'Atualização diária',
    ]) {
      expect(switchOf(`Desligar ${name}`).getAttribute('aria-checked')).toBe('true')
    }
    expect(
      screen.getByText('A entrega vai mudar, então o trabalho precisa de uma fila em ordem.'),
    ).toBeTruthy()
    expect(
      screen.getByText('Você quer controlar custo: horas × valor/hora de cada pessoa.'),
    ).toBeTruthy()
  })

  it('trocar o chip para Tradicional troca a lista de módulos', async () => {
    const { user } = setup()

    await user.click(chip('Tradicional'))

    expect(chip('Tradicional').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('switch', { name: 'Desligar Sprints' })).toBeNull()
    expect(switchOf('Desligar EAP (Entregas)').getAttribute('aria-checked')).toBe('true')
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

describe('RecommendationScreen: fidelidade ao design (tela 02)', () => {
  it('o título traz o método em destaque, e o chip mostra só o nome do preset', () => {
    setup()
    const title = screen.getByRole('heading', { level: 1 })
    expect(title.textContent).toBe('Ágil (Scrum)')
    expect(within(title).getByText('(Scrum)').className).toContain('method')
    expect(chip('Ágil').textContent).toContain('recomendado')
    expect(chip('Ágil').textContent).not.toContain('(Scrum)')
  })

  it('mostra "Pergunta 6 de 6" no cartão da experiência', () => {
    setup()
    expect(screen.getByText('Pergunta 6 de 6')).toBeTruthy()
  })

  it('o rodapé traz só Voltar e Criar projeto; Esc continua cancelando', async () => {
    const { user, props } = setup()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Criar projeto' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('a nota de módulos ocultos segue o texto do design', () => {
    setup()
    expect(
      screen.getByText(
        'Critério de pronto e Burndown entram quando a equipe já trabalha com Scrum. Os outros 7 ficam em Módulos.',
      ),
    ).toBeTruthy()
  })
})

describe('RecommendationScreen: exemplo do design (Algumas vezes)', () => {
  const DESIGN_ANSWERS: WizardAnswers = { ...AGIL_ANSWERS, experience: 'sometimes' }

  it('o resumo do trabalho vem do core, com a frase do design', () => {
    setup({ answers: DESIGN_ANSWERS })
    expect(
      screen.getByText(
        'Trabalho com começo e fim, sem data fixa e com entrega que vai mudar. Ciclos curtos deixam a equipe ajustar o rumo a cada duas semanas.',
      ),
    ).toBeTruthy()
  })

  it('a lista tem seis módulos e o botão "Ver todos" abre os outros sete', async () => {
    const { user } = setup({ answers: DESIGN_ANSWERS })

    expect(screen.getByText('6 módulos')).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Desligar Agenda' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Desligar Burndown e velocidade' })).toBeNull()

    const more = screen.getByRole('button', { name: 'Ver todos' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    await user.click(more)

    expect(more.getAttribute('aria-expanded')).toBe('true')
    const list = screen.getByRole('list', { name: 'Outros módulos' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(7)
    expect(within(list).getByText('Limites WIP')).toBeTruthy()
    expect(within(list).getByText('Linha de base')).toBeTruthy()
  })

  it('o título e o chip de Scrum seguem o preset recomendado', () => {
    setup({ answers: DESIGN_ANSWERS })
    expect(screen.getByRole('heading', { name: 'Ágil (Scrum)' })).toBeTruthy()
    expect(screen.getByText('Pergunta 6 de 6')).toBeTruthy()
  })
})
