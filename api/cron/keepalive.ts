/**
 * Cron diário (vercel.json) que faz uma requisição ao Supabase para o projeto
 * free não ser pausado por inatividade. A Vercel envia `Authorization: Bearer $CRON_SECRET`.
 * TODO: quando houver tabelas, trocar por um SELECT leve em uma tabela real.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return Response.json({ ok: false, error: 'Supabase não configurado' }, { status: 500 })
  }

  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key } })
  return Response.json({ ok: res.ok, status: res.status }, { status: res.ok ? 200 : 502 })
}
