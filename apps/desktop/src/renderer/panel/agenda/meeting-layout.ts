import type { MeetingDto } from '@agilebox/contract'

export const meetingMinutes = (time: string): number =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export interface PositionedMeeting {
  readonly meeting: MeetingDto
  readonly lane: number
  readonly lanes: number
  readonly top: number
  readonly height: number
}

/** Layout only. Every MVP meeting occupies one hour; touching intervals do not overlap. */
export function positionMeetings(meetings: readonly MeetingDto[]): PositionedMeeting[] {
  const sorted = [...meetings].sort(
    (a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
  )
  const result: PositionedMeeting[] = []
  let cluster: { meeting: MeetingDto; lane: number }[] = []
  let laneEnds: number[] = []
  let end = -1
  function flush() {
    for (const item of cluster) {
      const start = meetingMinutes(item.meeting.time)
      const top = Math.max(0, ((start - 480) / 60) * 52)
      const bottom = Math.min(520, ((start + 60 - 480) / 60) * 52)
      if (bottom > top) result.push({ ...item, lanes: laneEnds.length, top, height: bottom - top })
    }
    cluster = []
    laneEnds = []
    end = -1
  }
  for (const meeting of sorted) {
    const start = meetingMinutes(meeting.time)
    if (start >= end) flush()
    const available = laneEnds.findIndex((at) => at <= start)
    const lane = available === -1 ? laneEnds.length : available
    laneEnds[lane] = start + 60
    end = Math.max(end, start + 60)
    cluster.push({ meeting, lane })
  }
  flush()
  return result
}
