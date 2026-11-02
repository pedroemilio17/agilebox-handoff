import styles from './Charts.module.css'

export interface ChartDatum {
  readonly label: string
  readonly value: number
}
export interface ChartProps {
  readonly label: string
  readonly data: readonly ChartDatum[]
}

function chartLabel(
  label: string,
  data: readonly { readonly label: string; readonly value: number | null }[],
): string {
  return `${label}: ${data.length ? data.map((item) => `${item.label}: ${item.value ?? 'sem dados'}`).join('; ') : 'sem dados'}`
}

export interface SparklineProps {
  readonly label: string
  readonly data: readonly { readonly label: string; readonly value: number | null }[]
}
export function Sparkline({ label, data }: SparklineProps) {
  const max = Math.max(1, ...data.map((item) => item.value ?? 0))
  const points = data.map((item, index) =>
    item.value === null
      ? null
      : {
          x: data.length === 1 ? 100 : 4 + (index / Math.max(1, data.length - 1)) * 192,
          y: 46 - (item.value / max) * 40,
        },
  )
  const segments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  for (const point of points) {
    if (point) current.push(point)
    else {
      if (current.length) segments.push(current)
      current = []
    }
  }
  if (current.length) segments.push(current)
  const last = points.at(-1)
  return (
    <svg
      className={styles.sparkline}
      viewBox="0 0 200 52"
      role="img"
      aria-label={chartLabel(label, data)}
    >
      {segments.map((segment, index) => (
        <polyline
          key={index}
          points={segment.map(({ x, y }) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2"
        />
      ))}
      {last && <circle cx={last.x} cy={last.y} r="3" fill="var(--color-primary-bg)" />}
    </svg>
  )
}

export function BarChart({ label, data }: ChartProps) {
  const max = Math.max(1, ...data.map((item) => item.value))
  const width = Math.max(1, data.length) * 48
  return (
    <svg
      className={styles.bars}
      viewBox={`0 0 ${width} 140`}
      role="img"
      aria-label={chartLabel(label, data)}
    >
      {data.map((item, index) => {
        const height = Math.max(0, item.value / max) * 94
        return (
          <g key={`${item.label}-${index}`}>
            <text x={index * 48 + 24} y={112 - height} textAnchor="middle">
              {item.value}
            </text>
            <rect
              className={styles.bar}
              x={index * 48 + 10}
              y={118 - height}
              width="28"
              height={height}
              rx="3"
              fill={
                index === data.length - 1 ? 'var(--color-primary-bg)' : 'var(--color-avatar-bg)'
              }
            />
            <text x={index * 48 + 24} y="136" textAnchor="middle">
              {item.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
