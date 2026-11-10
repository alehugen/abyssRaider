import { describe, expect, it } from 'vitest'
import { groupByDay, myRsvp, rsvpCounts, weeklyOccurrences, type RaidEvent } from './RaidEvent'

const event: RaidEvent = {
  id: 'e1',
  partyId: 'p1',
  startsAt: new Date(2026, 10, 13, 21, 0),
  note: null,
  rsvps: [
    { eventId: 'e1', memberId: 'm1', ownerId: 'u1', status: 'going' },
    { eventId: 'e1', memberId: 'm2', ownerId: 'u2', status: 'going' },
    { eventId: 'e1', memberId: 'm3', ownerId: 'u3', status: 'maybe' },
  ],
}

describe('RaidEvent', () => {
  it('gera ocorrências semanais no mesmo horário local, com limite', () => {
    const dates = weeklyOccurrences(new Date(2026, 10, 13, 21, 0), 3)
    expect(dates.map((d) => [d.getDate(), d.getHours()])).toEqual([
      [13, 21],
      [20, 21],
      [27, 21],
    ])
    expect(weeklyOccurrences(new Date(), 50)).toHaveLength(8)
    expect(weeklyOccurrences(new Date(), 0)).toHaveLength(1)
  })

  it('conta respostas e acha a do membro', () => {
    expect(rsvpCounts(event)).toEqual({ going: 2, maybe: 1, declined: 0 })
    expect(myRsvp(event, 'm3')).toBe('maybe')
    expect(myRsvp(event, 'm9')).toBeNull()
  })

  it('agrupa por dia local em ordem', () => {
    const items = [new Date(2026, 10, 14, 10), new Date(2026, 10, 13, 22), new Date(2026, 10, 13, 20)]
    const days = groupByDay(items, (d) => d)
    expect(days.map((g) => [g.day.getDate(), g.items.map((d) => d.getHours())])).toEqual([
      [13, [20, 22]],
      [14, [10]],
    ])
  })
})
