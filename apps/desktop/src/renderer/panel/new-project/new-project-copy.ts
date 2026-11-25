/** Textos do novo projeto (design `novo-projeto.html`). Em pt-BR. */
export const newProjectCopy = {
  title: 'Criar novo projeto',
  subtitle: 'Comece simples em 1 clique ou responda 3 perguntas sem jargão técnico.',
  stepperLabel: 'Etapas da criação',
  steps: ['1. Nome', '2. Perguntas', '3. Revisão'],
  nameLabel: 'Nome do projeto',
  namePlaceholder: 'Ex.: Portal de Atendimento ao Cliente',
  nameRequired: 'Digite um nome para o projeto antes de continuar.',
  descLabel: 'Descrição breve (opcional)',
  descPlaceholder: 'Ex.: Organizar chamados e entregas semanais da equipe de TI',
  expressEyebrow: 'Mais rápido',
  expressTitle: 'Começar direto com o Quadro',
  expressText:
    'Cria o projeto apenas com o Quadro nos 5 estados oficiais, sem telas extras para configurar.',
  statesLabel: 'Os 5 estados oficiais',
  express: 'Criar projeto simples agora',
  guidedEyebrow: 'Personalizado · 30 seg',
  guidedTitle: 'Personalizar para o seu ritmo',
  guidedText:
    'Responda 3 perguntas rápidas sobre como o time trabalha e veja o formato recomendado antes de criar.',
  guided: 'Me ajude a escolher em 3 perguntas →',
  questionsProject: 'Projeto',
  questionsMeta: (count: number) => `${count} perguntas rápidas`,
  backToName: '← Voltar ao nome',
  toReview: 'Ver sugestão de recursos →',
  reviewEyebrow: 'Revisão final',
  reassurance: '✓ Você pode ligar ou desligar recursos depois em Configurações sem perder dados.',
  presetsLabel: 'Outro ponto de partida',
  backToQuestions: '← Voltar às perguntas',
  create: 'Criar projeto e ir ao Quadro',
} as const

export const STATES = [
  { key: 'statePlanning', label: 'Planejamento' },
  { key: 'stateTodo', label: 'A fazer' },
  { key: 'stateInProgress', label: 'Desenvolvendo' },
  { key: 'stateReview', label: 'Revisar' },
  { key: 'stateDone', label: 'Concluído' },
] as const
