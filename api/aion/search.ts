import { badRequest, errorResponse, isRegion, json, searchCharacters } from '../_lib/aion.js'

/** GET /api/aion/search?region=eu&name=Lele[&serverId=1313] */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const region = params.get('region')
  const name = params.get('name')?.trim() ?? ''
  const serverId = Number(params.get('serverId')) || undefined

  if (!isRegion(region)) return badRequest('Região inválida')
  if (name.length < 2 || name.length > 32) return badRequest('Informe um nome entre 2 e 32 caracteres')

  try {
    const results = await searchCharacters({ region, name, serverId })
    return json({ results }, 300)
  } catch (error) {
    return errorResponse(error)
  }
}
