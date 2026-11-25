/**
 * Web Push: o banco (pg_net) manda para /api/push/send os aparelhos de quem deve
 * ser avisado e o evento; aqui o texto é montado no idioma de cada aparelho e
 * enviado. Horários sempre no horário de Brasília, como no app.
 */

export type PushLocale = 'pt-BR' | 'en' | 'es'

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
  locale: PushLocale
}

export interface RaidPushData {
  party_name?: string
  /** ISO */
  starts_at?: string
  note?: string
  event_id?: string
  /** Lembrete automático (cron), não o do líder. */
  auto?: boolean
}

export type PushEvent =
  | { kind: 'raid_scheduled' | 'raid_cancelled' | 'raid_reminder'; partyId: string | null; data: RaidPushData }
  | { kind: 'patch_notes'; data: { id: string; title: string } }

/** O que o service worker mostra (ver src/pwa/pushHandlers.ts). */
export interface PushMessage {
  title: string
  body: string
  /** Caminho no app aberto ao tocar. */
  url: string
  /** Mesma tag substitui a notificação anterior (ex.: marcada -> lembrete da mesma raid). */
  tag: string
}

const TIME_ZONE = 'America/Sao_Paulo'
const INTL: Record<PushLocale, string> = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-419' }

const TEXT: Record<
  PushLocale,
  {
    party: string
    at: (date: string, time: string) => string
    tz: string
    scheduled: (party: string) => string
    reminderAuto: (party: string) => string
    reminderLeader: (party: string) => string
    raidBody: (at: string) => string
    cancelled: (party: string) => string
    cancelledBody: (at: string) => string
    cancelledNoDate: string
    patchNotes: string
  }
> = {
  'pt-BR': {
    party: 'sua party',
    at: (d, t) => `${d}, às ${t}`,
    tz: 'horário de Brasília',
    scheduled: (p) => `Raid marcada em ${p}`,
    reminderAuto: (p) => `Raid em breve: ${p}`,
    reminderLeader: (p) => `Lembrete do líder: ${p}`,
    raidBody: (at) => `${at}.`,
    cancelled: (p) => `Raid cancelada em ${p}`,
    cancelledBody: (at) => `A raid de ${at} foi cancelada.`,
    cancelledNoDate: 'Uma raid foi cancelada.',
    patchNotes: 'Patch notes novos',
  },
  en: {
    party: 'your party',
    at: (d, t) => `${d} at ${t}`,
    tz: 'Brasília time',
    scheduled: (p) => `Raid scheduled in ${p}`,
    reminderAuto: (p) => `Raid soon: ${p}`,
    reminderLeader: (p) => `Leader reminder: ${p}`,
    raidBody: (at) => `${at}.`,
    cancelled: (p) => `Raid canceled in ${p}`,
    cancelledBody: (at) => `The raid on ${at} was canceled.`,
    cancelledNoDate: 'A raid was canceled.',
    patchNotes: 'New patch notes',
  },
  es: {
    party: 'tu party',
    at: (d, t) => `${d}, a las ${t}`,
    tz: 'hora de Brasilia',
    scheduled: (p) => `Raid programada en ${p}`,
    reminderAuto: (p) => `Raid pronto: ${p}`,
    reminderLeader: (p) => `Recordatorio del líder: ${p}`,
    raidBody: (at) => `${at}.`,
    cancelled: (p) => `Raid cancelada en ${p}`,
    cancelledBody: (at) => `La raid del ${at} se canceló.`,
    cancelledNoDate: 'Se canceló una raid.',
    patchNotes: 'Nuevas notas del parche',
  },
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

/** "Quarta-feira, 26 de novembro, às 21:00 (horário de Brasília)" */
function raidAt(iso: string | undefined, locale: PushLocale): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const intl = INTL[locale]
  const date = new Intl.DateTimeFormat(intl, { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  const time = new Intl.DateTimeFormat(intl, { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(d)
  // O ICU novo usa espaço estreito em "9:00 PM": nas notificações fica estranho.
  return `${capitalize(TEXT[locale].at(date, time))} (${TEXT[locale].tz})`.replace(/[  ]/g, ' ')
}

export function pushMessage(event: PushEvent, locale: PushLocale): PushMessage {
  const tx = TEXT[locale]
  if (event.kind === 'patch_notes') {
    return { title: tx.patchNotes, body: event.data.title, url: `/patch-notes/${event.data.id}`, tag: `patch-${event.data.id}` }
  }
  const { data } = event
  const party = data.party_name || tx.party
  const at = raidAt(data.starts_at, locale)
  const url = event.partyId ? `/parties/${event.partyId}` : '/agenda'
  const tag = `raid-${data.event_id ?? event.partyId ?? 'agenda'}`
  const withNote = (body: string) => [body, data.note && `“${data.note}”`].filter(Boolean).join(' ')

  switch (event.kind) {
    case 'raid_scheduled':
      return { title: tx.scheduled(party), body: withNote(at ? tx.raidBody(at) : ''), url, tag }
    case 'raid_reminder':
      return {
        title: data.auto ? tx.reminderAuto(party) : tx.reminderLeader(party),
        body: withNote(at ? tx.raidBody(at) : ''),
        url,
        tag,
      }
    case 'raid_cancelled':
      return { title: tx.cancelled(party), body: at ? tx.cancelledBody(at) : tx.cancelledNoDate, url, tag }
  }
}

const DAY = 86_400

/** Por quanto tempo o serviço de push tenta entregar (aparelho desligado): lembrete só até a raid começar. */
export function pushTtl(event: PushEvent, now = Date.now()): number {
  if (event.kind === 'raid_reminder' && event.data.starts_at) {
    const left = Math.floor((Date.parse(event.data.starts_at) - now) / 1000)
    if (Number.isFinite(left)) return Math.min(DAY, Math.max(60, left))
  }
  return DAY
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isText = (v: unknown, max = 2048): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const RAID_KINDS = ['raid_scheduled', 'raid_cancelled', 'raid_reminder'] as const
const toLocale = (v: unknown): PushLocale => (v === 'en' || v === 'es' ? v : 'pt-BR')

/** Valida o corpo que o banco manda: { subscriptions: [...], event: {...} }. */
export function parseSendRequest(body: unknown): { targets: PushTarget[]; event: PushEvent } | null {
  if (!isObject(body) || !Array.isArray(body.subscriptions) || !isObject(body.event)) return null
  const targets: PushTarget[] = []
  for (const s of body.subscriptions) {
    if (!isObject(s) || !isText(s.endpoint) || !s.endpoint.startsWith('https://') || !isText(s.p256dh, 200) || !isText(s.auth, 100)) {
      return null
    }
    targets.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, locale: toLocale(s.locale) })
  }
  if (!targets.length || targets.length > 1000) return null

  const e = body.event
  const data = isObject(e.data) ? e.data : null
  if (!data) return null
  if (e.kind === 'patch_notes') {
    if (!isText(data.id, 200) || !isText(data.title, 500)) return null
    return { targets, event: { kind: 'patch_notes', data: { id: data.id, title: data.title } } }
  }
  if (!RAID_KINDS.includes(e.kind as (typeof RAID_KINDS)[number])) return null
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    targets,
    event: {
      kind: e.kind as (typeof RAID_KINDS)[number],
      partyId: str(e.partyId) ?? null,
      data: {
        party_name: str(data.party_name),
        starts_at: str(data.starts_at),
        note: str(data.note),
        event_id: str(data.event_id),
        auto: data.auto === true,
      },
    },
  }
}

export type SendFn = (
  target: PushTarget,
  payload: string,
  options: { TTL: number; urgency: 'normal' | 'high'; topic?: string },
) => Promise<unknown>

export interface SendHandlerDeps {
  /** PUSH_SECRET: o mesmo de public.push_config.secret no banco. */
  secret: string | undefined
  /** null quando faltam as chaves VAPID na Vercel. */
  send: SendFn | null
  /** Apaga no banco os aparelhos que cancelaram a inscrição. */
  forget: (endpoints: string[]) => Promise<void>
  /** Compara sem vazar o segredo pelo tempo de resposta. */
  safeEqual: (a: string, b: string) => boolean
}

/** POST /api/push/send (quem chama é o banco, com `Authorization: Bearer <segredo>`). */
export async function handlePushSend(request: Request, deps: SendHandlerDeps): Promise<Response> {
  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  if (!deps.secret || !given || !deps.safeEqual(given, deps.secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!deps.send) return Response.json({ error: 'VAPID não configurado' }, { status: 500 })

  const parsed = parseSendRequest(await request.json().catch(() => null))
  if (!parsed) return Response.json({ error: 'corpo inválido' }, { status: 400 })

  const result = await sendAll(parsed.targets, parsed.event, deps.send)
  if (result.gone.length) await deps.forget(result.gone).catch(() => {}) // tenta de novo no próximo envio
  return Response.json(result)
}

/** Envia a todos; 404/410 = o aparelho cancelou a inscrição (vai para `gone`, para o banco apagar). */
export async function sendAll(
  targets: readonly PushTarget[],
  event: PushEvent,
  send: SendFn,
  now = Date.now(),
): Promise<{ sent: number; failed: number; gone: string[] }> {
  const TTL = pushTtl(event, now)
  const urgency = event.kind === 'raid_reminder' ? 'high' : 'normal'
  const results = await Promise.allSettled(
    targets.map((t) => send(t, JSON.stringify(pushMessage(event, t.locale)), { TTL, urgency })),
  )
  const gone: string[] = []
  let sent = 0
  let failed = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') return void sent++
    const code = isObject(r.reason) ? r.reason.statusCode : undefined
    if (code === 404 || code === 410) gone.push(targets[i]!.endpoint)
    else failed++
  })
  return { sent, failed, gone }
}
