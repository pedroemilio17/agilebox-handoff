/**
 * Índice da cor do quadradinho de um projeto (1 a 5, `--color-project-N`). A cor vem do id, sem
 * guardar cor no projeto: a mesma regra da barra lateral.
 */
export function swatchIndexOf(id: string): number {
  return Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}
