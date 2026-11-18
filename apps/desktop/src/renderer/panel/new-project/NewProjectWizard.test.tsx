import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewProjectWizard } from './NewProjectWizard'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setup(initialName?: string) {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  const onSkip = vi.fn()
  const onFinishQuestions = vi.fn()
  render(
    <NewProjectWizard
      {...(initialName === undefined ? {} : { initialName })}
      onCancel={onCancel}
      onSkip={onSkip}
      onFinishQuestions={onFinishQuestions}
    />,
  )
  return { user, onCancel, onSkip, onFinishQuestions }
}

const nameInput = () => screen.getByRole('textbox', { name: 'Nome do projeto' })
const question = (text: string) => screen.getByRole('heading', { name: text })
const continueButton = () => screen.getByRole('button', { name: /^Continuar/ })
const radio = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name })

async function startWith(user: ReturnType<typeof userEvent.setup>, name = 'App de Chamados') {
  await user.type(nameInput(), name)
  await user.click(continueButton())
}

describe('NewProjectWizard: perguntas 1 a 5', () => {
  it('percorre o fluxo completo com trabalho que tem fim e entrega o resultado', async () => {
    const { user, onFinishQuestions } = setup()
    await startWith(user)

    await user.click(radio('Tem fim'))
    await user.click(continueButton())
    await user.click(radio('Sim'))
    await user.click(continueButton())
    expect(question('O que vai ser entregue já está definido?')).toBeTruthy()
    await user.click(radio('Sim, está tudo definido'))
    await user.click(continueButton())
    await user.click(radio('Sim'))
    await user.click(continueButton())
    await user.click(radio('Não'))
    await user.click(continueButton())

    expect(onFinishQuestions).toHaveBeenCalledWith(
      'App de Chamados',
      {
        workType: 'finite',
        fixedDate: 'yes',
        scope: 'defined',
        outsiderFollows: 'yes',
        controlsHoursAndCost: 'no',
      },
      expect.any(Object),
    )
  })

  it('trabalho contínuo pula data e escopo e o contador acompanha', async () => {
    const { user } = setup()
    await startWith(user)
    expect(screen.getByText('Pergunta 1 de 6')).toBeTruthy()
    expect(screen.getByText('Faltam 5 perguntas')).toBeTruthy()

    await user.click(radio('Contínuo'))
    await user.click(continueButton())

    expect(question('Alguém de fora acompanha por entregas e datas?')).toBeTruthy()
    expect(screen.getByText('Pergunta 2 de 4')).toBeTruthy()
    expect(screen.getByText('Faltam 2 perguntas')).toBeTruthy()
    const rail = screen.getByRole('list')
    expect(within(rail).getAllByText('Não se aplica')).toHaveLength(2)
  })

  it('Voltar restaura a resposta anterior', async () => {
    const { user } = setup()
    await startWith(user)
    await user.click(radio('Tem fim'))
    await user.click(continueButton())
    await user.click(radio('Não'))
    await user.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(
      question('Esse trabalho tem começo e fim, ou é contínuo, com pedidos chegando sempre?'),
    ).toBeTruthy()
    expect(radio('Tem fim').checked).toBe(true)
    await user.click(continueButton())
    expect(question('Existe uma data final que não pode mudar?')).toBeTruthy()
    expect(radio('Não').checked).toBe(true)
  })

  it('aceita "Não sei" em todas as perguntas', async () => {
    const { user, onFinishQuestions } = setup()
    await startWith(user)
    await user.click(radio('Não sei'))
    await user.click(continueButton())
    await user.click(radio('Não sei'))
    await user.click(continueButton())
    await user.click(radio('Não sei'))
    await user.click(continueButton())
    await user.click(radio('Não sei'))
    await user.click(continueButton())
    await user.click(radio('Não sei'))
    await user.click(continueButton())

    expect(onFinishQuestions).toHaveBeenCalledWith(
      'App de Chamados',
      {
        workType: 'unknown',
        fixedDate: 'unknown',
        scope: 'unknown',
      },
      expect.any(Object),
    )
  })

  it('o trilho mostra as respostas já dadas', async () => {
    const { user } = setup()
    await startWith(user)
    await user.click(radio('Tem fim'))
    await user.click(continueButton())
    await user.click(radio('Sim'))
    await user.click(continueButton())
    await user.click(radio('Em parte'))
    await user.click(continueButton())

    const rail = screen.getByRole('complementary', { name: 'Etapas do assistente' })
    expect(within(rail).getByText('Tem começo e fim')).toBeTruthy()
    expect(within(rail).getByText('Data fixa')).toBeTruthy()
    expect(within(rail).getByText('Em parte definido')).toBeTruthy()
    // Nome aparece no cabeçalho do trilho e na linha Nome.
    expect(within(rail).getAllByText('App de Chamados')).toHaveLength(2)
  })

  it('radios têm papel e nome acessíveis, agrupados em fieldset com legenda', async () => {
    const { user } = setup()
    await startWith(user)
    expect(screen.getByRole('group', { name: 'Escolha uma' })).toBeTruthy()
    expect(
      screen.getAllByRole('radio').map((item) => item.getAttribute('aria-labelledby') !== null),
    ).toEqual([true, true, true])
    expect(radio('Tem fim').value).toBe('finite')
    expect(radio('Contínuo').value).toBe('continuous')
    expect(radio('Não sei').value).toBe('unknown')
  })
})

describe('NewProjectWizard: nome, pular e teclado', () => {
  it('Pular cria no modo Simples com o nome digitado', async () => {
    const { user, onSkip, onFinishQuestions } = setup()
    await user.type(nameInput(), '  Portal  ')
    await user.click(screen.getByRole('button', { name: 'Pular e criar no modo Simples' }))
    expect(onSkip).toHaveBeenCalledWith('Portal')
    expect(onFinishQuestions).not.toHaveBeenCalled()
  })

  it('nome vazio bloqueia Pular e Continuar com mensagem curta', async () => {
    const { user, onSkip, onFinishQuestions } = setup()
    await user.click(screen.getByRole('button', { name: 'Pular e criar no modo Simples' }))
    expect(screen.getByRole('alert').textContent).toBe('Dê um nome ao projeto para continuar.')
    expect(nameInput().getAttribute('aria-invalid')).toBe('true')

    await user.click(continueButton())
    expect(onSkip).not.toHaveBeenCalled()
    expect(onFinishQuestions).not.toHaveBeenCalled()
    expect(question('Qual é o nome do projeto?')).toBeTruthy()
  })

  it('Enter avança do nome para a primeira pergunta e a cada pergunta', async () => {
    const { user } = setup('Painel')
    await user.click(nameInput())
    await user.keyboard('{Enter}')
    expect(
      question('Esse trabalho tem começo e fim, ou é contínuo, com pedidos chegando sempre?'),
    ).toBeTruthy()

    await user.click(radio('Tem fim'))
    await user.keyboard('{Enter}')
    expect(question('Existe uma data final que não pode mudar?')).toBeTruthy()
  })

  it('Esc cancela', async () => {
    const { user, onCancel } = setup()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('começa com o foco no nome e prende o Tab dentro do diálogo', async () => {
    const { user } = setup()
    expect(document.activeElement).toBe(nameInput())
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('devolve o foco ao elemento anterior ao fechar', () => {
    const outside = document.createElement('button')
    outside.textContent = 'Novo projeto'
    document.body.appendChild(outside)
    outside.focus()
    const { unmount } = render(
      <NewProjectWizard onCancel={() => {}} onSkip={() => {}} onFinishQuestions={() => {}} />,
    )
    expect(document.activeElement).not.toBe(outside)
    act(() => unmount())
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})
