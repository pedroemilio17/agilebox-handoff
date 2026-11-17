import { cleanup, render, screen } from '@testing-library/react'
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
  render(
    <NewProjectFlow
      {...(initialName === undefined ? {} : { initialName })}
      onCancel={vi.fn()}
      onCreate={onCreate}
    />,
  )
  return { user, onCreate }
}

const continueButton = () => screen.getByRole('button', { name: /^Continuar/ })
const radio = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name })

/** Responde as perguntas de um projeto ágil com custo e horas, até a recomendação. */
async function answerToRecommendation(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Nome do projeto' }), 'App de Chamados')
  await user.click(continueButton())
  await user.click(radio('Tem fim'))
  await user.click(continueButton())
  await user.click(radio('Não'))
  await user.click(continueButton())
  await user.click(radio('Vai mudar no caminho'))
  await user.click(continueButton())
  await user.click(radio('Não'))
  await user.click(continueButton())
  await user.click(radio('Sim'))
  await user.click(continueButton())
}

describe('NewProjectFlow', () => {
  it('pular cria o projeto Simples, sem respostas nem módulos', async () => {
    const { user, onCreate } = setup('Portal')

    await user.click(screen.getByRole('button', { name: 'Pular e criar no modo Simples' }))

    expect(onCreate).toHaveBeenCalledWith({ name: 'Portal', startedFromPreset: 'simples' })
  })

  it('termina as perguntas, mostra a recomendação e cria com o payload completo', async () => {
    const { user, onCreate } = setup()

    await answerToRecommendation(user)
    expect(screen.getByRole('heading', { name: 'Ágil (Scrum)' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Criar projeto' }))

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

  it('Voltar da recomendação reabre a última pergunta com as respostas preservadas', async () => {
    const { user, onCreate } = setup()
    await answerToRecommendation(user)

    await user.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(
      screen.getByRole('heading', { name: 'Vocês precisam controlar horas e custo?' }),
    ).toBeTruthy()
    expect(radio('Sim').checked).toBe(true)

    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: 'Criar projeto' }))

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
})
