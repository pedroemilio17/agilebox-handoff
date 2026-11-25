import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewProjectFlow, type NewProjectPayload } from './NewProjectFlow'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setup(initialName?: string) {
  const user = userEvent.setup()
  const onCreate = vi.fn<(payload: NewProjectPayload) => void>()
  const onCancel = vi.fn()
  render(
    <NewProjectFlow
      {...(initialName === undefined ? {} : { initialName })}
      onCancel={onCancel}
      onCreate={onCreate}
    />,
  )
  return { user, onCreate, onCancel }
}

const toReview = () => screen.getByRole('button', { name: 'Ver sugestão de recursos →' })
const radio = (name: string | RegExp) => screen.getByRole<HTMLInputElement>('radio', { name })
const nameField = () => screen.getByRole('textbox', { name: 'Nome do projeto' })

/** Responde as perguntas de um projeto ágil com custo e horas, até a revisão. */
async function answerToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.type(nameField(), 'App de Chamados')
  await user.click(screen.getByRole('button', { name: /^Me ajude a escolher/ }))
  await user.click(radio('Tem fim'))
  await user.click(
    within(screen.getByRole('group', { name: /data final/ })).getByRole('radio', { name: 'Não' }),
  )
  await user.click(radio(/^Vai mudar no caminho/))
  await user.click(
    within(screen.getByRole('group', { name: /Alguém de fora/ })).getByRole('radio', {
      name: 'Não',
    }),
  )
  await user.click(
    within(screen.getByRole('group', { name: /controlar horas/ })).getByRole('radio', {
      name: 'Sim',
    }),
  )
  await user.click(toReview())
}

describe('NewProjectFlow: página', () => {
  it('é uma página, sem diálogo, com cabeçalho e stepper do desenho', () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Criar novo projeto' })).toBeTruthy()
    expect(
      screen.getByText('Comece simples em 1 clique ou responda 3 perguntas sem jargão técnico.'),
    ).toBeTruthy()
    const stepper = screen.getByRole('list', { name: 'Etapas da criação' })
    expect(
      within(stepper)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['1. Nome', '·2. Perguntas', '·3. Revisão'])
    expect(within(stepper).getByText('1. Nome').getAttribute('aria-current')).toBe('step')
  })

  it('mostra o erro de criação na própria página', () => {
    render(
      <NewProjectFlow
        initialName="Portal"
        error="Não foi possível criar o projeto."
        onCancel={vi.fn()}
        onCreate={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível criar o projeto.')
  })

  it('Esc cancela', async () => {
    const { user, onCancel } = setup()
    await user.click(nameField())
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('NewProjectFlow: caminho rápido', () => {
  it('"Criar projeto simples agora" cria o projeto Simples, sem respostas nem módulos', async () => {
    const { user, onCreate } = setup('Portal')
    await user.click(screen.getByRole('button', { name: 'Criar projeto simples agora' }))
    expect(onCreate).toHaveBeenCalledWith({ name: 'Portal', startedFromPreset: 'simples' })
  })

  it('sem nome, mostra o erro e não cria nem avança', async () => {
    const { user, onCreate } = setup()
    await user.click(screen.getByRole('button', { name: 'Criar projeto simples agora' }))
    expect(screen.getByRole('alert').textContent).toBe(
      'Digite um nome para o projeto antes de continuar.',
    )
    expect(document.activeElement).toBe(nameField())
    expect(onCreate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^Me ajude a escolher/ }))
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('bloqueia novo envio enquanto cria', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(
      <NewProjectFlow initialName="Portal" submitting onCancel={vi.fn()} onCreate={onCreate} />,
    )
    const express = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Criar projeto simples agora',
    })
    expect(express.disabled).toBe(true)
    await user.click(express)
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('NewProjectFlow: perguntas e revisão', () => {
  it('termina as perguntas, mostra a revisão e cria com o payload completo', async () => {
    const { user, onCreate } = setup()

    await answerToReview(user)
    expect(screen.getByRole('heading', { level: 2, name: 'App de Chamados' })).toBeTruthy()
    expect(screen.getByText('Ágil (Scrum)')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Criar projeto e ir ao Quadro' }))

    expect(onCreate).toHaveBeenCalledWith({
      name: 'App de Chamados',
      startedFromPreset: 'agil',
      guideLevel: 'never',
      modules: [
        'agenda',
        'backlog',
        'sprints',
        'checkins',
        'estimates.hours',
        'reviewRetro',
        'cost',
      ],
      answers: {
        workType: 'finite',
        fixedDate: 'no',
        scope: 'will_change',
        outsiderFollows: 'no',
        controlsHoursAndCost: 'yes',
        experience: 'never',
      },
    })
  })

  it('o stepper acompanha a etapa', async () => {
    const { user } = setup()
    await answerToReview(user)
    const stepper = screen.getByRole('list', { name: 'Etapas da criação' })
    expect(within(stepper).getByText('3. Revisão').getAttribute('aria-current')).toBe('step')
  })

  it('voltar da revisão reabre as perguntas com as respostas preservadas', async () => {
    const { user, onCreate } = setup()
    await answerToReview(user)

    await user.click(screen.getByRole('button', { name: '← Voltar às perguntas' }))

    expect(radio('Tem fim').checked).toBe(true)
    expect(radio(/^Vai mudar no caminho/).checked).toBe(true)

    await user.click(toReview())
    await user.click(screen.getByRole('button', { name: 'Criar projeto e ir ao Quadro' }))
    const payload = onCreate.mock.calls[0]?.[0]
    expect(payload && 'answers' in payload ? payload.answers : null).toEqual({
      workType: 'finite',
      fixedDate: 'no',
      scope: 'will_change',
      outsiderFollows: 'no',
      controlsHoursAndCost: 'yes',
      experience: 'never',
    })
  })

  it('voltar ao nome mantém o que foi digitado', async () => {
    const { user } = setup()
    await user.type(nameField(), 'Portal')
    await user.click(screen.getByRole('button', { name: /^Me ajude a escolher/ }))
    await user.click(screen.getByRole('button', { name: '← Voltar ao nome' }))
    expect(nameField().getAttribute('value') ?? (nameField() as HTMLInputElement).value).toBe(
      'Portal',
    )
  })
})
