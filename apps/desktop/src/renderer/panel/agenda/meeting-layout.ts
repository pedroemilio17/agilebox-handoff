import type { MeetingOccurrenceDto } from '@agilebox/contract'

/** Início da grade (08:00) e fim (18:00), em minutos. */
export const GRID_START = 480
export const GRID_END = 1080
export const HOUR_PX = 52

export const meetingMinutes = (time: string): number =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

/** Chave estável de uma ocorrência: série + dia (uma série aparece em cada dia que repete). */
export const occurrenceKey = (meeting: MeetingOccurrenceDto): string =>
  `${meeting.seriesId}|${meeting.occurrenceDate}`

/**
 * Fim efetivo da ocorrência em minutos. O servidor já devolve `occurrenceEndTime`
 * (fim informado ou início + 1 hora, decisão D6); se vier um fim que não passa do início,
 * vale a mesma regra de 1 hora.
 */
export function occurrenceEndMinutes(
  meeting: Pick<MeetingOccurrenceDto, 'time' | 'occurrenceEndTime'>,
): number {
  const start = meetingMinutes(meeting.time)
  const end = meetingMinutes(meeting.occurrenceEndTime)
  return end > start ? end : start + 60
}

/** Fora da grade de 08–18: começa antes de 08:00 ou termina depois de 18:00. */
export const isOutsideGrid = (meeting: MeetingOccurrenceDto): boolean =>
  meetingMinutes(meeting.time) < GRID_START || occurrenceEndMinutes(meeting) > GRID_END

export interface PositionedMeeting {
  readonly meeting: MeetingOccurrenceDto
  readonly lane: number
  readonly lanes: number
  readonly top: number
  readonly height: number
}

/**
 * Layout only. Cada ocorrência ocupa do início ao fim (52 px por hora); intervalos encostados
 * não se sobrepõem. Sobrepostos dividem a largura em faixas.
 */
export function positionMeetings(meetings: readonly MeetingOccurrenceDto[]): PositionedMeeting[] {
  const sorted = [...meetings].sort(
    (a, b) =>
      a.time.localeCompare(b.time) ||
      a.seriesId.localeCompare(b.seriesId) ||
      a.occurrenceDate.localeCompare(b.occurrenceDate),
  )
  const result: PositionedMeeting[] = []
  let cluster: { meeting: MeetingOccurrenceDto; lane: number; end: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  function flush() {
    for (const item of cluster) {
      const start = meetingMinutes(item.meeting.time)
      const top = Math.max(0, ((start - GRID_START) / 60) * HOUR_PX)
      const bottom = Math.min(
        ((GRID_END - GRID_START) / 60) * HOUR_PX,
        ((item.end - GRID_START) / 60) * HOUR_PX,
      )
      if (bottom > top)
        result.push({
          meeting: item.meeting,
          lane: item.lane,
          lanes: laneEnds.length,
          top,
          height: bottom - top,
        })
    }
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }
  for (const meeting of sorted) {
    const start = meetingMinutes(meeting.time)
    const end = occurrenceEndMinutes(meeting)
    if (start >= clusterEnd) flush()
    const available = laneEnds.findIndex((at) => at <= start)
    const lane = available === -1 ? laneEnds.length : available
    laneEnds[lane] = end
    clusterEnd = Math.max(clusterEnd, end)
    cluster.push({ meeting, lane, end })
  }
  flush()
  return result
}
