import { isDateOnly, parseDateOnly, type DateOnly } from '../values/date-only'

export interface QuickAddPerson {
  readonly id: string
  readonly name: string
  readonly initials: string
}
export interface QuickAddProject {
  readonly id: string
  readonly name: string
}
export interface QuickAddContext {
  readonly today: DateOnly
  readonly people: readonly QuickAddPerson[]
  readonly projects: readonly QuickAddProject[]
}
export interface QuickAddToken {
  readonly kind: 'person' | 'project' | 'date'
  readonly text: string
  readonly start: number
  readonly end: number
  readonly value: string
  readonly label: string
}
export interface QuickAddResult {
  readonly title: string
  readonly responsibleId: string | null
  readonly projectId: string | null
  readonly deadline: DateOnly | null
  readonly status: 'todo'
  readonly tokens: readonly QuickAddToken[]
}
const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')

function normalizedInput(input: string) {
  let text = ''
  const positions: number[] = []
  let offset = 0
  for (const char of input) {
    const normalized = fold(char)
    for (let index = 0; index < normalized.length; index++) positions.push(offset)
    text += normalized
    offset += char.length
  }
  positions.push(input.length)
  return { text, positions }
}
function shiftDate(today: DateOnly, days: number): DateOnly {
  const date = new Date(`${today}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return parseDateOnly(date.toISOString().slice(0, 10))
}
function dateCandidate(day: number, month: number, year: number): DateOnly | null {
  const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isDateOnly(value) ? value : null
}

/** Pure parser. Unknown/ambiguous references and invalid dates remain in the title. */
export function parseQuickAdd(input: string, context: QuickAddContext): QuickAddResult {
  const { text, positions } = normalizedInput(input)
  const tokens: QuickAddToken[] = []
  const occupied = (start: number, end: number) =>
    tokens.some((token) => start < token.end && end > token.start)
  function add(
    kind: QuickAddToken['kind'],
    index: number,
    length: number,
    value: string,
    label: string,
  ) {
    const start = positions[index]!
    const end = positions[index + length]!
    if (!occupied(start, end) && !tokens.some((token) => token.kind === kind))
      tokens.push({ kind, start, end, text: input.slice(start, end), value, label })
  }
  // Longest exact full name wins; a short prefix is accepted only when it identifies one entry.
  for (const match of text.matchAll(/(^|\s)([@#])/gu)) {
    const index = match.index + match[1]!.length
    const kind = match[2] === '@' ? 'person' : 'project'
    const source = text.slice(index + 1)
    const entries: readonly (QuickAddProject & { readonly initials?: string })[] =
      kind === 'person' ? context.people : context.projects
    const exact = entries
      .flatMap((entry) => {
        const aliases = [entry.name, ...(entry.initials ? [entry.initials] : [])]
        return aliases
          .map(fold)
          .filter(
            (alias) =>
              source.startsWith(alias) &&
              (!source[alias.length] || /[\s.,;!?]/u.test(source[alias.length]!)),
          )
          .map((alias) => ({ entry, length: alias.length }))
      })
      .sort((a, b) => b.length - a.length)
    const longest = exact[0]
    if (
      longest &&
      !exact.some(
        (candidate) =>
          candidate.entry.id !== longest.entry.id && candidate.length === longest.length,
      )
    ) {
      add(kind, index, longest.length + 1, longest.entry.id, longest.entry.name)
      continue
    }
    if (exact.length) continue
    const prefix = /^[^\s@#.,;!?]+/u.exec(source)?.[0]
    if (!prefix) continue
    const candidates = entries.filter(
      (entry) =>
        fold(entry.name).startsWith(prefix) ||
        (entry.initials !== undefined && fold(entry.initials).startsWith(prefix)),
    )
    if (candidates.length === 1)
      add(kind, index, prefix.length + 1, candidates[0]!.id, candidates[0]!.name)
  }
  const weekdays = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
  const year = Number(context.today.slice(0, 4))
  const month = Number(context.today.slice(5, 7))
  for (const match of text.matchAll(
    /\b(hoje|amanha|domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|dia\s+\d{1,2}|\d{1,2}\/\d{1,2})\b/gu,
  )) {
    const raw = match[0]
    const start = positions[match.index]!
    const end = positions[match.index + raw.length]!
    if (
      occupied(start, end) ||
      /[@#/\d]/u.test(text[match.index - 1] ?? '') ||
      /[@#/\d]/u.test(text[match.index + raw.length] ?? '')
    )
      continue
    let deadline: DateOnly | null
    if (raw === 'hoje' || raw === 'amanha')
      deadline = shiftDate(context.today, raw === 'hoje' ? 0 : 1)
    else if (raw.startsWith('dia ')) {
      const day = Number(raw.slice(4))
      deadline = dateCandidate(day, month, year)
      if (deadline !== null && deadline < context.today)
        deadline = dateCandidate(day, month === 12 ? 1 : month + 1, month === 12 ? year + 1 : year)
    } else if (raw.includes('/')) {
      const [day, targetMonth] = raw.split('/').map(Number)
      deadline = dateCandidate(day!, targetMonth!, year)
      if (deadline !== null && deadline < context.today)
        deadline = dateCandidate(day!, targetMonth!, year + 1)
    } else {
      const weekday = weekdays.indexOf(raw.replace('-feira', ''))
      const current = new Date(`${context.today}T12:00:00Z`).getUTCDay()
      deadline = shiftDate(context.today, (weekday - current + 7) % 7)
    }
    if (deadline) add('date', match.index, raw.length, deadline, deadline)
  }
  const ordered = [...tokens].sort((a, b) => a.start - b.start)
  let title = ''
  let cursor = 0
  for (const token of ordered) {
    title += input.slice(cursor, token.start)
    cursor = token.end
  }
  title += input.slice(cursor)
  const value = (kind: QuickAddToken['kind']) =>
    tokens.find((token) => token.kind === kind)?.value ?? null
  return {
    title: title.replace(/\s+/gu, ' ').trim(),
    responsibleId: value('person'),
    projectId: value('project'),
    deadline: value('date') as DateOnly | null,
    status: 'todo',
    tokens: ordered,
  }
}
