import { badRequest, errorResponse, getItem, isRegion, json } from '../_lib/aion.js'

/** GET /api/aion/item?region=eu&serverId=1313&id=<characterId>&itemId=1&slot=1&enchant=15: uma peça equipada. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const region = params.get('region')
  const serverId = Number(params.get('serverId'))
  const id = params.get('id') ?? ''
  const itemId = Number(params.get('itemId'))
  const slot = Number(params.get('slot'))
  const enchantLevel = Number(params.get('enchant') ?? 0)

  if (!isRegion(region)) return badRequest('Região inválida')
  if (!Number.isInteger(serverId) || serverId <= 0) return badRequest('Servidor inválido')
  if (!id || id.length > 128) return badRequest('Personagem inválido')
  if (!Number.isInteger(itemId) || itemId <= 0) return badRequest('Item inválido')
  if (!Number.isInteger(slot) || slot <= 0 || slot > 99) return badRequest('Slot inválido')
  if (!Number.isInteger(enchantLevel) || enchantLevel < 0 || enchantLevel > 30) return badRequest('Encantamento inválido')

  try {
    const item = await getItem({ region, serverId, id, itemId, slot, enchantLevel })
    if (!item) return Response.json({ error: 'Item não encontrado' }, { status: 404 })
    return json({ item }, 300)
  } catch (error) {
    return errorResponse(error)
  }
}
