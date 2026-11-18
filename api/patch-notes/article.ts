import { badRequest, errorResponse, json } from '../_lib/aion.js'
import { getPatchNote, parsePatchLang } from '../_lib/patchNotes.js'

/** GET /api/patch-notes/article?id=...&lang=pt-BR|en|es: patch note completo, em seções e tópicos. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const id = params.get('id')
  if (!id) return badRequest('Informe o patch note.')
  try {
    return json({ note: await getPatchNote(id, parsePatchLang(params.get('lang'))) }, 3600)
  } catch (error) {
    return errorResponse(error)
  }
}
