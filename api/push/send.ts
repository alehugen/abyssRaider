import { timingSafeEqual } from 'node:crypto'
import webpush from 'web-push'
import { handlePushSend } from '../_lib/push.js'

/**
 * POST /api/push/send: o banco (pg_net) manda os aparelhos e o evento; esta função
 * assina com a chave VAPID e entrega pelo serviço de push de cada navegador.
 *
 * Variáveis na Vercel (Settings > Environment Variables):
 *   PUSH_SECRET        o mesmo de `select secret from public.push_config`
 *   VAPID_PRIVATE_KEY  chave privada (só aqui, nunca no front nem no repositório)
 *   VITE_VAPID_PUBLIC_KEY  chave pública (o front também usa)
 *   VAPID_SUBJECT      opcional: mailto: ou https:// de contato (padrão: endereço do app)
 */
const SEND_TIMEOUT_MS = 10_000

export async function POST(request: Request): Promise<Response> {
  const env = process.env
  const publicKey = env.VITE_VAPID_PUBLIC_KEY || env.VAPID_PUBLIC_KEY
  const privateKey = env.VAPID_PRIVATE_KEY
  const secret = env.PUSH_SECRET
  const vapidDetails =
    publicKey && privateKey
      ? { subject: env.VAPID_SUBJECT || new URL(request.url).origin, publicKey, privateKey }
      : null

  return handlePushSend(request, {
    secret,
    send: vapidDetails
      ? (t, payload, options) =>
          webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, {
            ...options,
            vapidDetails,
            // Um serviço de push lento não segura os outros até o limite da função.
            timeout: SEND_TIMEOUT_MS,
          })
      : null,
    forget: async (endpoints) => {
      // Função do banco protegida pelo mesmo segredo: não precisa da service_role.
      const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
      const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
      if (!url || !key) return console.error('[push] sem Supabase configurado: aparelhos que saíram não foram apagados')
      const res = await fetch(`${url}/rest/v1/rpc/push_forget`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_secret: secret, p_endpoints: endpoints }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      })
      if (!res.ok) console.error('[push] push_forget falhou', res.status, await res.text().catch(() => ''))
    },
    safeEqual: (a, b) => {
      const x = Buffer.from(a)
      const y = Buffer.from(b)
      return x.length === y.length && timingSafeEqual(x, y)
    },
  })
}
