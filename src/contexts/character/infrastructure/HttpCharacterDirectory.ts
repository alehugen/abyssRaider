import type { Character, CharacterSummary, Region, Server } from '../domain/Character'
import type { CharacterBuild, Gear, GearDetail } from '../domain/CharacterBuild'
import type { CharacterDirectory, CharacterRef } from '../domain/CharacterDirectory'

type Fetch = typeof fetch

const refParams = (ref: CharacterRef) =>
  new URLSearchParams({ region: ref.region, serverId: String(ref.serverId), id: ref.id })

/** Fala com as funções /api/aion/* (proxy na Vercel, ou plugin do Vite em dev). */
export class HttpCharacterDirectory implements CharacterDirectory {
  private readonly baseUrl: string
  private readonly fetchFn: Fetch

  constructor(baseUrl = '/api/aion', fetchFn: Fetch = (...args) => fetch(...args)) {
    this.baseUrl = baseUrl
    this.fetchFn = fetchFn
  }

  async search(query: { region: Region; name: string; serverId?: number }): Promise<CharacterSummary[]> {
    const params = new URLSearchParams({ region: query.region, name: query.name })
    if (query.serverId) params.set('serverId', String(query.serverId))
    const { results } = await this.getJson<{ results: Array<CharacterSummary & { portraitUrl: string | null }> }>(
      `/search?${params}`,
    )
    return results.map(({ portraitUrl, ...rest }) => ({ ...rest, ...(portraitUrl ? { portraitUrl } : {}) }))
  }

  async get(ref: CharacterRef): Promise<Character | null> {
    const params = new URLSearchParams({ region: ref.region, serverId: String(ref.serverId), id: ref.id })
    try {
      const { character } = await this.getJson<{ character: RawCharacter }>(`/character?${params}`)
      return fromRaw(character)
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null
      throw e
    }
  }

  async servers(region: Region): Promise<Server[]> {
    const { servers } = await this.getJson<{ servers: Server[] }>(`/servers?region=${region}`)
    return servers
  }

  async build(ref: CharacterRef): Promise<CharacterBuild | null> {
    try {
      const { build } = await this.getJson<{ build: CharacterBuild }>(`/build?${refParams(ref)}`)
      return build
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null
      throw e
    }
  }

  async gear(ref: CharacterRef, gear: Pick<Gear, 'itemId' | 'slot' | 'enchantLevel'>): Promise<GearDetail> {
    const params = refParams(ref)
    params.set('itemId', String(gear.itemId))
    params.set('slot', String(gear.slot))
    params.set('enchant', String(gear.enchantLevel))
    const { item } = await this.getJson<{ item: GearDetail }>(`/item?${params}`)
    return item
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, { headers: { accept: 'application/json' } })
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) throw new HttpError(body?.error ?? `Erro ${res.status} ao consultar o Aion`, res.status)
    return body as T
  }
}

export class HttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError' // mensagem vem da nossa API, já em português
    this.status = status
  }
}

interface RawCharacter extends Omit<Character, 'combatPower' | 'itemLevel' | 'portraitUrl'> {
  combatPower: number | null
  itemLevel: number | null
  portraitUrl: string | null
}

function fromRaw(raw: RawCharacter): Character {
  const { combatPower, itemLevel, portraitUrl, ...rest } = raw
  return {
    ...rest,
    ...(combatPower != null ? { combatPower } : {}),
    ...(itemLevel != null ? { itemLevel } : {}),
    ...(portraitUrl ? { portraitUrl } : {}),
  }
}
