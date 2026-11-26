import { MODULE_LABELS, type ModuleId } from '@agilebox/core'
import { panelCopy } from '../../panel/copy'
import { trayCopy } from '../../tray/copy'

/**
 * Termos de Scrum e de fluxo avançado que o time Básico de Kanban simples não deve ver (PLANO-2.0,
 * "time Básico trabalha sem saber Scrum"). Usada pelos testes de fluxo e pela auditoria.
 *
 * Os textos de `copy.ts` entram como constantes, para a lista seguir a interface real.
 */

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Palavra ou início de palavra (aceita plural e sufixo), sem diferenciar maiúsculas. */
const startsWord = (text: string) => new RegExp(`(?<!\\p{L})${escapeRegExp(text)}`, 'iu')

/** Palavra inteira, com diferenciação de maiúsculas (ex.: a sigla WIP). */
const exactWord = (text: string) => new RegExp(`(?<!\\p{L})${escapeRegExp(text)}(?!\\p{L})`, 'u')

/** Módulos de Scrum e fluxo avançado: nenhum deles existe no preset Kanban simples. */
export const SCRUM_AND_FLOW_MODULES: readonly ModuleId[] = [
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'estimates.points',
  'acceptance',
  'wip',
  'subtasks',
  'flowMetrics',
  'reviewRetro',
  'burndown',
]

/**
 * Efeitos passivos de impedimentos: aparecem em qualquer nível quando o módulo está ativo (PLANO-2.0).
 * Fora deles, o texto de bloqueio é o que o time de Scrum Básico pode ver no quadro e no detalhe.
 */
export const PASSIVE_IMPEDIMENT_TERMS: readonly RegExp[] = [
  startsWord('Bloqueada'),
  startsWord('Bloqueadas'),
]

/**
 * Efeitos passivos de critérios e estimativa (M3.3): só o marcador no card, em qualquer nível com o
 * módulo ligado. As telas (seção de critérios e campo de estimativa) continuam proibidas no Básico.
 */
export const PASSIVE_TOOL_TERMS: readonly RegExp[] = [
  startsWord('Critério'),
  startsWord('Estimativa'),
]

/**
 * Nomes de telas que o Básico vê desde o ADR-10 (o nível não esconde tela): o item de menu e o
 * título aparecem; as ações e medidores que dependem do nível continuam nos termos proibidos.
 */
export const SCREEN_NAME_TERMS: readonly RegExp[] = [
  startsWord('Backlog'),
  startsWord('Sprint'),
  startsWord('Bloqueio'),
  startsWord('Impedimento'),
  startsWord('Impedimentos'),
  startsWord('Histórico de impedimentos'),
]

export const FORBIDDEN_TERMS: readonly RegExp[] = [
  // Nomes de ferramentas (catálogo de MODULE_LABELS) e as palavras-raiz deles.
  startsWord('Backlog'),
  startsWord('Sprint'),
  // Vocabulário das telas de sprint (M4.3): só onde `sprints:screen` existe.
  startsWord('Replanejar'),
  startsWord('Planejamento da sprint'),
  startsWord('Encerrar sprint'),
  startsWord('Sprint ativa'),
  startsWord(MODULE_LABELS.acceptance),
  startsWord('Estimativa'),
  startsWord('Check-in'),
  startsWord(MODULE_LABELS.checkins),
  startsWord(MODULE_LABELS.reviewRetro),
  startsWord('Daily'),
  startsWord('Impedimento'),
  // Vocabulário novo de impedimentos (M5.2b): tela, resolver, quem resolve e a bandeja.
  startsWord('Impedimentos'),
  startsWord('Resolver impedimento'),
  startsWord('Quem resolve'),
  startsWord('Seus impedimentos abertos'),
  startsWord('Histórico de impedimentos'),
  startsWord('Subtarefa'),
  startsWord('Retro'),
  startsWord('Combinado'),
  startsWord('Burndown'),
  startsWord('Velocity'),
  startsWord(MODULE_LABELS.flowMetrics),
  // Vocabulário do backlog e dos critérios (M3.3): "Backlog" e "Critérios" só onde a ferramenta existe.
  startsWord('Critério'),
  startsWord('Estimado'),
  startsWord('Puxar'),
  // Controles e textos de impedimento, subtarefas e fluxo.
  startsWord(panelCopy.blockAction),
  startsWord(panelCopy.unblockAction),
  startsWord(panelCopy.blockedSection),
  ...PASSIVE_IMPEDIMENT_TERMS,
  startsWord('Limite de WIP'),
  exactWord('WIP'),
  // Medidor de WIP: "Desenvolvendo: 1 de 3" no cabeçalho da coluna.
  /: \d+ de \d+/u,
  startsWord('Ciclo médio'),
  startsWord('tempo de ciclo'),
  // Cartão de convite da daily.
  startsWord(trayCopy.dailyInviteTitle),
  startsWord(trayCopy.dailyInviteBody),
]

/** Textos visíveis de uma árvore: texto dos nós e aria-label, title e placeholder. Pula `skip`. */
export function visibleTextOf(root: Element, skip?: Element): string {
  const parts: string[] = []
  const walk = (node: Element) => {
    if (node === skip) return
    for (const attribute of ['aria-label', 'title', 'placeholder']) {
      const value = node.getAttribute(attribute)
      if (value) parts.push(value)
    }
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) parts.push(child.textContent ?? '')
      else if (child instanceof Element) walk(child)
    }
  }
  walk(root)
  return parts.join('\n')
}

/** Termos proibidos encontrados no texto, pela forma da expressão (para a mensagem de erro). */
export function forbiddenTermsIn(text: string): string[] {
  return FORBIDDEN_TERMS.filter((term) => term.test(text)).map((term) => term.source)
}
