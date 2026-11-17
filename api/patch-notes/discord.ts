import { errorResponse, json } from '../_lib/aion.js'
import { discordEmbed, getPatchNote, listPatchNotes } from '../_lib/patchNotes.js'

/**
 * GET /api/patch-notes/discord: os 3 patch notes mais recentes já no formato de
 * embed do Discord. Quem chama é o cron do banco (patch_notes_tick), que guarda
 * o que já foi postado e manda só os novos para o webhook do canal.
 */
export async function GET(): Promise<Response> {
  try {
    const latest = await listPatchNotes(3)
    const notes = await Promise.all(latest.map((s) => getPatchNote(s.id)))
    return json(
      { posts: notes.map((n) => ({ id: n.id, postedAt: n.postedAt, title: n.title, embed: discordEmbed(n) })) },
      600,
    )
  } catch (error) {
    return errorResponse(error)
  }
}
