/** Entrada que pode ser citada com @ (pessoa) ou # (projeto) em um texto livre. */
export interface ReferenceEntry {
  readonly id: string
  readonly name: string
  readonly initials?: string
}

export interface ReferenceMatch<Entry extends ReferenceEntry> {
  readonly entry: Entry
  /** Caracteres (já normalizados) consumidos depois do marcador. */
  readonly length: number
}

export const foldReference = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')

/**
 * Casa o texto que segue um marcador (já normalizado com `foldReference`).
 * 1) Nome completo ou iniciais: vence o alias mais longo; empate entre entradas diferentes é ambíguo.
 * 2) Sem casamento exato: prefixo único do primeiro trecho, pelo nome ou pelas iniciais.
 * Ambíguo ou desconhecido devolve `null`.
 */
export function matchReference<Entry extends ReferenceEntry>(
  source: string,
  entries: readonly Entry[],
): ReferenceMatch<Entry> | null {
  const exact = entries
    .flatMap((entry) => {
      const aliases = [entry.name, ...(entry.initials ? [entry.initials] : [])]
      return aliases
        .map(foldReference)
        .filter(
          (alias) =>
            source.startsWith(alias) &&
            (!source[alias.length] || /[\s.,;!?]/u.test(source[alias.length]!)),
        )
        .map((alias) => ({ entry, length: alias.length }))
    })
    .sort((a, b) => b.length - a.length)
  const longest = exact[0]
  if (longest) {
    const ambiguous = exact.some(
      (candidate) => candidate.entry.id !== longest.entry.id && candidate.length === longest.length,
    )
    return ambiguous ? null : longest
  }
  const prefix = /^[^\s@#.,;!?]+/u.exec(source)?.[0]
  if (!prefix) return null
  const candidates = entries.filter(
    (entry) =>
      foldReference(entry.name).startsWith(prefix) ||
      (entry.initials !== undefined && foldReference(entry.initials).startsWith(prefix)),
  )
  return candidates.length === 1 ? { entry: candidates[0]!, length: prefix.length } : null
}
