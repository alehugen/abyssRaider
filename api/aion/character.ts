import { badRequest, errorResponse, getCharacter, isRegion, json } from '../_lib/aion.js'

/** GET /api/aion/character?region=eu&serverId=1313&id=<characterId> */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const region = params.get('region')
  const serverId = Number(params.get('serverId'))
  const id = params.get('id') ?? ''

  if (!isRegion(region)) return badRequest('Região inválida')
  if (!Number.isInteger(serverId) || serverId <= 0) return badRequest('Servidor inválido')
  if (!id || id.length > 128) return badRequest('Personagem inválido')

  try {
    const character = await getCharacter({ region, serverId, id })
    if (!character) return Response.json({ error: 'Personagem não encontrado' }, { status: 404 })
    return json({ character }, 600)
  } catch (error) {
    return errorResponse(error)
  }
}
