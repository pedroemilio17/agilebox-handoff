/** Chaves de consulta do detalhe que o M3 acrescenta. As chaves compartilhadas ficam em `shared/query/keys.ts`. */
export const taskDetailKeys = {
  acceptance: (taskId: string) => ['agilebox', 'acceptance', taskId] as const,
}
