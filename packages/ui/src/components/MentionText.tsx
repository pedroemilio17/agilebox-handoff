import styles from './MentionText.module.css'

export interface MentionTextProps {
  readonly text: string
  readonly mentions: readonly { readonly id: string; readonly name: string }[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Texto de comentário com as menções destacadas. O trecho continua sendo o texto real (`@Nome`),
 * e o destaque também aparece em peso e fundo, não só em cor. Menção só vale para o nome citado.
 */
export function MentionText({ text, mentions }: MentionTextProps) {
  // Nomes maiores primeiro, para "Ana Souza" ganhar de "Ana" quando ambos forem mencionados.
  const names = [...new Set(mentions.map((mention) => mention.name))].sort(
    (a, b) => b.length - a.length,
  )
  if (names.length === 0) return <>{text}</>

  const pattern = new RegExp(`(${names.map((name) => escapeRegExp(`@${name}`)).join('|')})`, 'gu')
  // Com grupo de captura, os trechos casados ficam nas posições ímpares.
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return part
        const name = part.slice(1)
        return (
          <mark key={index} className={styles.mention} title={name} aria-label={part}>
            {part}
          </mark>
        )
      })}
    </>
  )
}
