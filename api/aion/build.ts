import { badRequest, errorResponse, getBuild, isRegion, json } from '../_lib/aion.js'

/** GET /api/aion/build?region=eu&serverId=1313&id=<characterId>: equipamento, atributos e skills. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const region = params.get('region')
  const serverId = Number(params.get('serverId'))
  const id = params.get('id') ?? ''

  if (!isRegion(region)) return badRequest('Região inválida')
  if (!Number.isInteger(serverId) || serverId <= 0) return badRequest('Servidor inválido')
  if (!id || id.length > 128) return badRequest('Personagem inválido')

  try {
    const build = await getBuild({ region, serverId, id })
    if (!build) return Response.json({ error: 'Personagem não encontrado' }, { status: 404 })
    return json({ build }, 300)
  } catch (error) {
    return errorResponse(error)
  }
}
