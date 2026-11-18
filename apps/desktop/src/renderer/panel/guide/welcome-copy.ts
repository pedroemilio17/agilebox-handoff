/** Textos da janela de boas-vindas do projeto (pt-BR). */
export const welcomeCopy = {
  eyebrow: 'Você entrou em um projeto',
  title: (projectName: string, name: string | null) =>
    name ? `Boas-vindas ao ${projectName}, ${name}` : `Boas-vindas ao ${projectName}`,
  presetIntro: (presetLabel: string, total: number) =>
    total === 0
      ? `Este projeto começou como ${presetLabel}: só o núcleo.`
      : `Este projeto começou como ${presetLabel}: ${modulesText(total)}.`,
  plainIntro: (total: number) =>
    total === 0 ? 'Este projeto usa só o núcleo.' : `Este projeto usa ${modulesText(total)}.`,
  trailQuestion: 'Quer ver a trilha de primeiros passos?',
  stepCount: (total: number) => (total === 1 ? '1 passo' : `${total} passos`),
  trailIntro: 'ajustados ao que já existe aqui.',
  stepList: 'Passos da trilha',
  hint: 'Dá para abrir depois pelo ? de qualquer tela.',
  later: 'Agora não',
  seeTrail: 'Ver a trilha',
  saveError: 'Não foi possível salvar sua resposta. Tente de novo.',
} as const

/** "1 módulo ligado" ou "N módulos ligados". */
export function modulesText(total: number): string {
  return total === 1 ? '1 módulo ligado' : `${total} módulos ligados`
}
