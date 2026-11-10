import { badRequest, errorResponse, isRegion, json, listServers } from '../_lib/aion.js'

/** GET /api/aion/servers?region=eu */
export async function GET(request: Request): Promise<Response> {
  const region = new URL(request.url).searchParams.get('region')
  if (!isRegion(region)) return badRequest('Região inválida')

  try {
    return json({ servers: await listServers(region) }, 86400)
  } catch (error) {
    return errorResponse(error)
  }
}
