import { errorResponse, json } from '../_lib/aion.js'
import { listPatchNotes, parsePatchLang } from '../_lib/patchNotes.js'

/** GET /api/patch-notes/list?limit=10&lang=pt-BR|en|es: últimos patch notes (sem o conteúdo). */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const limit = Number(params.get('limit') ?? 10) || 10
  try {
    return json({ notes: await listPatchNotes(limit, parsePatchLang(params.get('lang'))) }, 300)
  } catch (error) {
    return errorResponse(error)
  }
}
