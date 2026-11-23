/** Chave normalizada (sem acento, caixa nem espaços extras) para detectar nomes de projeto repetidos. */
export function projectNameKey(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/gu, ' ')
}
