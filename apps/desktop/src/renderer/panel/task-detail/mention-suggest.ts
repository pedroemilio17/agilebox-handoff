export interface MentionOption {
  readonly id: string
  readonly name: string
}

export interface MentionQuery {
  /** Posição do `@` no texto. */
  readonly start: number
  /** Texto digitado depois do `@`, até o cursor. */
  readonly query: string
}

/**
 * Detecta um `@` ativo antes do cursor: precisa estar no início ou depois de espaço,
 * e o texto até o cursor não pode ter quebra de linha.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at === -1) return null
  if (at > 0 && !/\s/u.test(before[at - 1]!)) return null
  const query = before.slice(at + 1)
  if (/[\r\n]/u.test(query)) return null
  return { start: at, query }
}

/** Candidatos cujo nome contém o texto digitado (sem diferenciar maiúsculas). */
export function filterMentionOptions(
  options: readonly MentionOption[],
  query: string,
): MentionOption[] {
  const term = query.trim().toLocaleLowerCase('pt-BR')
  return options.filter((option) => option.name.toLocaleLowerCase('pt-BR').includes(term))
}

/** Troca `@texto` pelo nome completo e devolve o novo texto e a posição do cursor. */
export function insertMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  name: string,
): { readonly text: string; readonly caret: number } {
  const insert = `@${name} `
  const next = text.slice(0, mention.start) + insert + text.slice(caret)
  return { text: next, caret: mention.start + insert.length }
}
