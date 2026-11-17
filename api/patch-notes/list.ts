import { errorResponse, json } from '../_lib/aion.js'
import { listPatchNotes } from '../_lib/patchNotes.js'

/** GET /api/patch-notes/list?limit=10: últimos patch notes (sem o conteúdo). */
export async function GET(request: Request): Promise<Response> {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 10) || 10
  try {
    return json({ notes: await listPatchNotes(limit) }, 300)
  } catch (error) {
    return errorResponse(error)
  }
}
