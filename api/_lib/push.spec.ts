import { describe, expect, it, vi } from 'vitest'
import {
  handlePushSend,
  parseSendRequest,
  pushMessage,
  pushTtl,
  sendAll,
  type PushEvent,
  type PushTarget,
  type SendHandlerDeps,
} from './push.js'

const raid = (kind: 'raid_scheduled' | 'raid_cancelled' | 'raid_reminder', extra: Record<string, unknown> = {}): PushEvent => ({
  kind,
  partyId: 'p1',
  // quinta, 26/11/2026 às 21:00 de Brasília
  data: { party_name: 'Os Daevas', starts_at: '2026-11-27T00:00:00Z', event_id: 'e1', ...extra },
})

const target = (endpoint: string, locale: PushTarget['locale'] = 'pt-BR'): PushTarget => ({
  endpoint,
  p256dh: 'k',
  auth: 'a',
  locale,
})

describe('pushMessage', () => {
  it('raid marcada: party no título, data e hora de Brasília no corpo, link da party', () => {
    const m = pushMessage(raid('raid_scheduled', { note: 'Levem poções' }), 'pt-BR')
    expect(m.title).toBe('Raid marcada em Os Daevas')
    expect(m.body).toBe('Quinta-feira, 26 de novembro, às 21:00 (horário de Brasília). “Levem poções”')
    expect(m.url).toBe('/parties/p1')
    expect(m.tag).toBe('raid-e1')
  })

  it('lembrete automático e lembrete do líder têm títulos diferentes', () => {
    expect(pushMessage(raid('raid_reminder', { auto: true }), 'pt-BR').title).toBe('Raid em breve: Os Daevas')
    expect(pushMessage(raid('raid_reminder'), 'pt-BR').title).toBe('Lembrete do líder: Os Daevas')
  })

  it('raid cancelada', () => {
    const m = pushMessage(raid('raid_cancelled'), 'en')
    expect(m.title).toBe('Raid canceled in Os Daevas')
    expect(m.body).toBe('The raid on Thursday, November 26 at 9:00 PM (Brasília time) was canceled.')
  })

  it('no idioma do aparelho (espanhol)', () => {
    expect(pushMessage(raid('raid_scheduled'), 'es').title).toBe('Raid programada en Os Daevas')
  })

  it('patch notes: título do patch e link para a página dele', () => {
    const m = pushMessage({ kind: 'patch_notes', data: { id: '6b06', title: 'Atualização de 26/11' } }, 'pt-BR')
    expect(m).toEqual({ title: 'Patch notes novos', body: 'Atualização de 26/11', url: '/patch-notes/6b06', tag: 'patch-6b06' })
  })

  it('sem nome da party ou data, ainda monta um texto', () => {
    const m = pushMessage({ kind: 'raid_cancelled', partyId: null, data: {} }, 'pt-BR')
    expect(m.title).toBe('Raid cancelada em sua party')
    expect(m.body).toBe('Uma raid foi cancelada.')
    expect(m.url).toBe('/agenda')
  })
})

describe('pushTtl', () => {
  it('lembrete vale até a raid começar; o resto, 1 dia', () => {
    const now = Date.parse('2026-11-26T23:00:00Z')
    expect(pushTtl(raid('raid_reminder'), now)).toBe(3600)
    expect(pushTtl(raid('raid_reminder'), Date.parse('2026-11-27T01:00:00Z'))).toBe(60)
    expect(pushTtl(raid('raid_scheduled'), now)).toBe(86400)
  })
})

describe('parseSendRequest', () => {
  it('aceita só o formato que o banco manda', () => {
    const ok = parseSendRequest({ subscriptions: [target('https://push/1')], event: raid('raid_scheduled') })
    expect(ok?.targets).toHaveLength(1)
    expect(parseSendRequest({ subscriptions: [], event: raid('raid_scheduled') })).toBeNull()
    expect(parseSendRequest({ subscriptions: [target('http://inseguro')], event: raid('raid_scheduled') })).toBeNull()
    expect(parseSendRequest({ subscriptions: [target('https://push/1')], event: { kind: 'outro', data: {} } })).toBeNull()
    expect(parseSendRequest(null)).toBeNull()
  })

  it('idioma desconhecido vira português', () => {
    const ok = parseSendRequest({ subscriptions: [{ ...target('https://push/1'), locale: 'fr' }], event: raid('raid_scheduled') })
    expect(ok?.targets[0]?.locale).toBe('pt-BR')
  })
})

describe('sendAll', () => {
  it('envia para cada aparelho e separa os que não existem mais (404/410)', async () => {
    const send = vi.fn(async (t: PushTarget, _payload: string, _options: { TTL: number }) => {
      if (t.endpoint.endsWith('/gone')) throw Object.assign(new Error('Gone'), { statusCode: 410 })
      if (t.endpoint.endsWith('/fail')) throw Object.assign(new Error('Erro'), { statusCode: 500 })
    })
    const result = await sendAll(
      [target('https://push/ok'), target('https://push/gone', 'en'), target('https://push/fail')],
      raid('raid_scheduled'),
      send,
    )
    expect(result).toEqual({ sent: 1, failed: 1, gone: ['https://push/gone'] })
    const payload = JSON.parse(send.mock.calls[1]![1])
    expect(payload.title).toBe('Raid scheduled in Os Daevas')
    expect(send.mock.calls[0]![2]).toMatchObject({ TTL: 86400 })
  })
})

describe('handlePushSend', () => {
  const body = { subscriptions: [target('https://push/ok'), target('https://push/gone')], event: raid('raid_scheduled') }
  const request = (auth: string | null, payload: unknown = body) =>
    new Request('https://app.test/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify(payload),
    })
  const deps = (over: Partial<SendHandlerDeps> = {}): SendHandlerDeps => ({
    secret: 's3cr3t',
    send: vi.fn(async (t: PushTarget) => {
      if (t.endpoint.endsWith('/gone')) throw Object.assign(new Error('Gone'), { statusCode: 410 })
    }),
    forget: vi.fn(async () => {}),
    safeEqual: (a, b) => a === b,
    ...over,
  })

  it('recusa sem o segredo certo', async () => {
    expect((await handlePushSend(request(null), deps())).status).toBe(401)
    expect((await handlePushSend(request('Bearer errado'), deps())).status).toBe(401)
    expect((await handlePushSend(request('Bearer s3cr3t'), deps({ secret: undefined }))).status).toBe(401)
  })

  it('sem chaves VAPID: erro de configuração', async () => {
    expect((await handlePushSend(request('Bearer s3cr3t'), deps({ send: null }))).status).toBe(500)
  })

  it('corpo inválido: 400', async () => {
    expect((await handlePushSend(request('Bearer s3cr3t', { x: 1 }), deps())).status).toBe(400)
  })

  it('envia e pede ao banco para apagar os aparelhos que saíram', async () => {
    const d = deps()
    const res = await handlePushSend(request('Bearer s3cr3t'), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1, failed: 0, gone: ['https://push/gone'] })
    expect(d.forget).toHaveBeenCalledWith(['https://push/gone'])
  })
})
