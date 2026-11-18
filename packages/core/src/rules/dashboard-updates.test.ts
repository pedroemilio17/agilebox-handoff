import { describe, expect, it } from 'vitest'
import type { TimelineEvent } from '../entities/timeline-event'
import { updateCategoryOf } from './dashboard-updates'

function event(type: TimelineEvent['type']): TimelineEvent {
  return { type, payload: {} } as unknown as TimelineEvent
}

describe('updateCategoryOf', () => {
  it('agrupa mudança de estado, estimativa e custo, prazo, comentário', () => {
    expect(updateCategoryOf(event('status_changed'))).toBe('status')
    expect(updateCategoryOf(event('estimate_changed'))).toBe('estimate')
    expect(updateCategoryOf(event('hours_changed'))).toBe('estimate')
    expect(updateCategoryOf(event('rate_changed'))).toBe('estimate')
    expect(updateCategoryOf(event('deadline_changed'))).toBe('deadline')
    expect(updateCategoryOf(event('start_changed'))).toBe('deadline')
    expect(updateCategoryOf(event('comment_added'))).toBe('comment')
    expect(updateCategoryOf(event('comment_removed'))).toBe('comment')
  })

  it('o resto vai para "other"', () => {
    expect(updateCategoryOf(event('renamed'))).toBe('other')
    expect(updateCategoryOf(event('blocked'))).toBe('other')
  })
})
