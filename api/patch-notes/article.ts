import { badRequest, errorResponse, json } from '../_lib/aion.js'
import { getPatchNote } from '../_lib/patchNotes.js'

/** GET /api/patch-notes/article?id=...: patch note completo, em seções e tópicos. */
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return badRequest('Informe o patch note.')
  try {
    return json({ note: await getPatchNote(id) }, 3600)
  } catch (error) {
    return errorResponse(error)
  }
}
