/** Horas como no protótipo: vírgula decimal e ao menos uma casa ("3,0", "2,25"). */
export function formatHoursValue(hours: number): string {
  const fixed = hours.toFixed(2)
  const trimmed = fixed.endsWith('0') ? fixed.slice(0, -1) : fixed
  return trimmed.replace('.', ',')
}

/** "3,0 h" (tabela e resumo). */
export function formatHoursLabel(hours: number): string {
  return `${formatHoursValue(hours)} h`
}

/** "5,0h" (contador do tópico, sem espaço). */
export function formatHoursCount(hours: number): string {
  return `${formatHoursValue(hours)}h`
}

/** Soma em centésimos para não acumular erro de ponto flutuante. */
export function addHours(base: number, amount: number): number {
  return Math.round((base + amount) * 100) / 100
}
