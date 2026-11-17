import { HttpError } from '@/contexts/character/infrastructure/HttpCharacterDirectory'
import type { PatchNote, PatchNoteSummary, PatchNotesRepository } from '../domain/PatchNote'

type Fetch = typeof fetch
type Raw<T> = Omit<T, 'postedAt'> & { postedAt: string }

/** Fala com /api/patch-notes/* (proxy na Vercel para a API da comunidade do AION 2). */
export class HttpPatchNotesRepository implements PatchNotesRepository {
  private readonly baseUrl: string
  private readonly fetchFn: Fetch

  constructor(baseUrl = '/api/patch-notes', fetchFn: Fetch = (...args) => fetch(...args)) {
    this.baseUrl = baseUrl
    this.fetchFn = fetchFn
  }

  async list(limit = 12): Promise<PatchNoteSummary[]> {
    const { notes } = await this.getJson<{ notes: Raw<PatchNoteSummary>[] }>(`/list?limit=${limit}`)
    return notes.map((n) => ({ ...n, postedAt: new Date(n.postedAt) }))
  }

  async get(id: string): Promise<PatchNote | null> {
    try {
      const { note } = await this.getJson<{ note: Raw<PatchNote> }>(`/article?id=${encodeURIComponent(id)}`)
      return { ...note, postedAt: new Date(note.postedAt) }
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null
      throw e
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, { headers: { accept: 'application/json' } })
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) throw new HttpError(body?.error ?? `Erro ${res.status} ao buscar os patch notes`, res.status)
    return body as T
  }
}
