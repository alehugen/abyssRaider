import { describe, expect, it } from 'vitest'
import { groupByDay, myRsvp, rsvpCounts, type RaidEvent } from './RaidEvent'

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
  it('conta respostas e acha a do membro', () => {
    expect(rsvpCounts(event)).toEqual({ going: 2, maybe: 1, declined: 0 })
    expect(myRsvp(event, 'm3')).toBe('maybe')
    expect(myRsvp(event, 'm9')).toBeNull()
  })

  it('agrupa por dia no horário de Brasília, em ordem', () => {
    const items = [
      new Date('2026-11-14T13:00:00Z'), // sáb 14, 10:00 em Brasília
      new Date('2026-11-14T01:00:00Z'), // sex 13, 22:00 em Brasília (já é sábado em UTC)
      new Date('2026-11-13T23:00:00Z'), // sex 13, 20:00 em Brasília
    ]
    const days = groupByDay(items, (d) => d)
    expect(days.map((g) => [g.key, g.items.length])).toEqual([
      ['2026-11-13', 2],
      ['2026-11-14', 1],
    ])
  })
})
