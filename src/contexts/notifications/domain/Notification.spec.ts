import { describe, expect, it } from 'vitest'
import { describeNotification, timeAgo, type AppNotification } from './Notification'

const n = (kind: AppNotification['kind'], data: AppNotification['data'] = {}): AppNotification => ({
  id: 1,
  kind,
  partyId: 'p1',
  data: { party_name: 'Ludra', character_name: 'Bi', leader_name: 'Lu', ...data },
  createdAt: new Date(),
  readAt: null,
})

describe('describeNotification', () => {
  it('monta título, texto e link de cada tipo', () => {
    expect(describeNotification(n('invite_received'))).toMatchObject({
      title: 'Convite para Ludra',
      body: 'Lu convidou Bi. Aceite ou recuse na página da party.',
      link: '/parties/p1',
    })
    expect(describeNotification(n('invite_accepted')).title).toBe('Bi aceitou o convite')
    expect(describeNotification(n('request_received')).title).toBe('Bi pediu para entrar')
    expect(describeNotification(n('request_accepted')).title).toBe('Você entrou em Ludra')
    expect(describeNotification(n('request_declined')).body).toBe('O líder de Ludra recusou Bi.')
  })

  it('raid usa o horário de Brasília e o recado', () => {
    // 12/11/2026 00:00 UTC = quarta 11/11, 21:00 em Brasília
    const v = describeNotification(n('raid_scheduled', { starts_at: '2026-11-12T00:00:00Z', note: 'levar poções' }))
    expect(v.title).toBe('Raid marcada em Ludra')
    expect(v.body).toContain('quarta-feira, 11 de novembro, às 21:00 (horário de Brasília)')
    expect(v.body).toContain('levar poções')
    expect(describeNotification(n('raid_cancelled', { starts_at: '2026-11-12T00:00:00Z' })).body).toContain(
      'quarta-feira, 11 de novembro, às 21:00',
    )
  })

  it('tempo relativo no passado', () => {
    const now = new Date('2026-11-10T20:00:00Z')
    expect(timeAgo(new Date('2026-11-10T19:59:30Z'), now)).toBe('agora')
    expect(timeAgo(new Date('2026-11-10T19:55:00Z'), now)).toBe('há 5 minutos')
    expect(timeAgo(new Date('2026-11-10T17:00:00Z'), now)).toBe('há 3 horas')
    expect(timeAgo(new Date('2026-11-09T20:00:00Z'), now)).toBe('ontem')
  })
})

describe('party excluída', () => {
  it('avisa sem link (a party não existe mais)', () => {
    const v = describeNotification({ id: 2, kind: 'party_deleted', partyId: null, data: { party_name: 'Ludra' }, createdAt: new Date(), readAt: null })
    expect(v).toMatchObject({ title: 'Ludra foi excluída', link: null })
  })
})
