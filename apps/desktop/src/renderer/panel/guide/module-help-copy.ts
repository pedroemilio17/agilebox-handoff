/** Textos da interface do botão "?" e do painel "Como funciona" (pt-BR). */
export const moduleHelpCopy = {
  eyebrow: 'Como funciona',
  buttonLabel: (moduleName: string) => `Como funciona: ${moduleName}`,
  buttonText: '?',
  close: 'Fechar',
  whyLabel: 'Por que existe',
  flowLabel: 'Fluxo',
  linksLabel: 'Ligação com outros módulos',
  noLinks: 'Este módulo não liga a outros.',
  linkKind: {
    requer: 'Requer',
    aproveita: 'Aproveita',
    alimenta: 'Alimenta',
  },
  stateOn: 'Ligado',
  stateOff: 'Desligado',
  stateLoading: 'Carregando',
  stateError: 'Indisponível',
  experiencePrefix: 'Seu guia:',
  experienceSuffix: 'definido pelo projeto.',
  reviewSteps: 'Rever os primeiros passos',
} as const
