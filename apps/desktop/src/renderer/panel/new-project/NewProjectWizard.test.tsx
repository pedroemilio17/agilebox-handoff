import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewProjectWizard, type NewProjectWizardProps } from './NewProjectWizard'
import { DEFAULT_WIZARD_DRAFT, type WizardDraft } from './wizard-steps'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Harness(
  props: Partial<NewProjectWizardProps> & { onDraft?: (draft: WizardDraft) => void },
) {
  const [name, setName] = useState(props.name ?? '')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<WizardDraft>(props.draft ?? DEFAULT_WIZARD_DRAFT)
  return (
    <NewProjectWizard
      phase={props.phase ?? 'name'}
      name={name}
      description={description}
      draft={draft}
      nameError={props.nameError ?? false}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onDraftChange={(next) => {
        setDraft(next)
        props.onDraft?.(next)
      }}
      onExpress={props.onExpress ?? vi.fn()}
      onGuided={props.onGuided ?? vi.fn()}
      onBackToName={props.onBackToName ?? vi.fn()}
      onToReview={props.onToReview ?? vi.fn()}
      {...(props.submitting === undefined ? {} : { submitting: props.submitting })}
    />
  )
}

describe('NewProjectWizard: passo 1 (nome e dois caminhos)', () => {
  it('mostra nome, descrição opcional e os dois caminhos do desenho', () => {
    render(<Harness />)
    const name = screen.getByRole('textbox', { name: 'Nome do projeto' })
    expect(name.getAttribute('placeholder')).toBe('Ex.: Portal de Atendimento ao Cliente')
    expect(document.activeElement).toBe(name)
    expect(screen.getByRole('textbox', { name: 'Descrição breve (opcional)' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Começar direto com o Quadro' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Personalizar para o seu ritmo' })).toBeTruthy()
    const states = screen.getByRole('list', { name: 'Os 5 estados oficiais' })
    expect(
      within(states)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Planejamento', 'A fazer', 'Desenvolvendo', 'Revisar', 'Concluído'])
    expect(screen.getByRole('button', { name: 'Criar projeto simples agora' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Me ajude a escolher em 3 perguntas →' }),
    ).toBeTruthy()
  })

  it('os botões chamam os caminhos; Enter no nome segue pelo caminho guiado', async () => {
    const user = userEvent.setup()
    const onExpress = vi.fn()
    const onGuided = vi.fn()
    render(<Harness onExpress={onExpress} onGuided={onGuided} />)
    await user.click(screen.getByRole('button', { name: 'Criar projeto simples agora' }))
    expect(onExpress).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /^Me ajude a escolher/ }))
    expect(onGuided).toHaveBeenCalledTimes(1)
    await user.type(screen.getByRole('textbox', { name: 'Nome do projeto' }), '{Enter}')
    expect(onGuided).toHaveBeenCalledTimes(2)
  })

  it('erro do nome usa o texto do desenho e liga o campo ao aviso', () => {
    render(<Harness nameError />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Digite um nome para o projeto antes de continuar.')
    expect(
      screen.getByRole('textbox', { name: 'Nome do projeto' }).getAttribute('aria-invalid'),
    ).toBe('true')
  })

  it('criando, bloqueia o caminho rápido', () => {
    render(<Harness submitting />)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Criar projeto simples agora' })
        .disabled,
    ).toBe(true)
  })
})

describe('NewProjectWizard: passo 2 (3 perguntas do novo-projeto.html)', () => {
  it('lista as 3 perguntas do HTML, numeradas, com o nome do projeto e padrões marcados', () => {
    render(<Harness phase="questions" name="Portal" />)
    expect(screen.getByText('Portal')).toBeTruthy()
    expect(screen.getByText('3 perguntas rápidas')).toBeTruthy()
    const titles = screen
      .getAllByRole('group')
      .map((group) => group.querySelector('legend')?.textContent)
    expect(titles).toEqual([
      '1. Como o time prefere organizar as entregas?',
      '2. Há clientes ou parceiros externos que precisam de previsibilidade?',
      '3. Como você descreve a experiência da equipe com organização?',
    ])
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /^Fluxo contínuo simples/ }).checked,
    ).toBe(true)
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /^Não, é um projeto interno/ }).checked,
    ).toBe(true)
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Iniciante/ }).checked).toBe(true)
  })

  it('escolher opções atualiza o rascunho e marca os cartões', async () => {
    const user = userEvent.setup()
    const onDraft = vi.fn()
    render(<Harness phase="questions" name="Portal" onDraft={onDraft} />)
    await user.click(screen.getByRole('radio', { name: /^Ciclos curtos com metas/ }))
    expect(onDraft).toHaveBeenLastCalledWith({
      deliveryMode: 'ciclos',
      externalVisibility: 'nao',
      experience: 'Iniciante',
    })
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /^Ciclos curtos com metas/ }).checked,
    ).toBe(true)
  })

  it('o rodapé volta ao nome e segue para a sugestão de recursos', async () => {
    const user = userEvent.setup()
    const onBackToName = vi.fn()
    const onToReview = vi.fn()
    render(
      <Harness
        phase="questions"
        name="Portal"
        onBackToName={onBackToName}
        onToReview={onToReview}
      />,
    )
    await user.click(screen.getByRole('button', { name: '← Voltar ao nome' }))
    await user.click(screen.getByRole('button', { name: 'Ver sugestão de recursos →' }))
    expect(onBackToName).toHaveBeenCalledTimes(1)
    expect(onToReview).toHaveBeenCalledTimes(1)
  })
})
