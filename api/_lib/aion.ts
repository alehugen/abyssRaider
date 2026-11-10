/**
 * Cliente das APIs públicas (não oficiais) do Aion 2 Global da NCSOFT.
 * O navegador não consegue chamá-las (CORS), por isso passam pelas funções
 * em /api/aion/*. Aqui só há normalização: as respostas cruas nunca chegam ao front.
 *
 * Pastas com "_" dentro de /api não viram rotas na Vercel.
 */

export const REGIONS = ['nae', 'naw', 'eu', 'la', 'as'] as const
export type Region = (typeof REGIONS)[number]
export type Faction = 'elyos' | 'asmodian'

export interface AionServer {
  id: number
  name: string
  faction: Faction
}

export interface AionSearchResult {
  id: string
  name: string
  faction: Faction
  level: number
  region: Region
  serverId: number
  serverName: string
  portraitUrl: string | null
}

export interface AionCharacter extends AionSearchResult {
  className: string
  combatPower: number | null
  itemLevel: number | null
}

const SEARCH_URL = 'https://api-search.plaync.com/aion2global/search/v2/character'
const INFO_URL = 'https://aion2.plaync.com/api/character/info'
const SERVERS_URL = 'https://aion2.plaync.com/en-us/api/gameinfo/servers'
const IMAGE_HOST = 'https://profileimg.plaync.com'

export class AionApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (REGIONS as readonly string[]).includes(value)
}

export function factionFromRace(race: unknown): Faction {
  return race === 2 ? 'asmodian' : 'elyos'
}

/** Remove o realce `<strong>` da busca (e qualquer outra tag). */
export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '')
}

/** A busca devolve o id já com URL-encoding (`...%3D`); o detalhe devolve cru (`...=`). */
export function decodeId(id: string): string {
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

function portrait(path: unknown): string | null {
  if (typeof path !== 'string' || !path) return null
  return path.startsWith('http') ? path : `${IMAGE_HOST}${path}`
}

function toInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; AbyssRaider)' },
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 429) throw new AionApiError('A API do Aion está limitando requisições. Tente em instantes.', 429)
  if (!res.ok) throw new AionApiError(`API do Aion respondeu ${res.status}`, 502)
  return res.json()
}

// ---------------------------------------------------------------- normalização

interface RawSearch {
  list?: Array<Record<string, unknown>>
}

export function normalizeSearch(raw: unknown, region: Region): AionSearchResult[] {
  const list = (raw as RawSearch)?.list ?? []
  return list.map((item) => ({
    id: decodeId(String(item.characterId)),
    name: stripTags(String(item.name ?? '')),
    faction: factionFromRace(item.race),
    level: toInt(item.level) ?? 0,
    region: isRegion(item.region) ? item.region : region,
    serverId: toInt(item.serverId) ?? 0,
    serverName: String(item.serverName ?? ''),
    portraitUrl: portrait(item.profileImageUrl),
  }))
}

interface RawInfo {
  profile?: Record<string, unknown>
  stat?: { statList?: Array<{ type?: string; value?: unknown }> }
}

export function normalizeCharacter(raw: unknown, region: Region): AionCharacter | null {
  const { profile, stat } = (raw ?? {}) as RawInfo
  if (!profile?.characterId) return null
  const itemLevel = stat?.statList?.find((s) => s.type === 'ItemLevel')?.value
  return {
    id: decodeId(String(profile.characterId)),
    name: String(profile.characterName ?? ''),
    faction: factionFromRace(profile.raceId),
    level: toInt(profile.characterLevel) ?? 0,
    region,
    serverId: toInt(profile.serverId) ?? 0,
    serverName: String(profile.serverName ?? ''),
    portraitUrl: portrait(profile.profileImage),
    className: String(profile.className ?? ''),
    combatPower: toInt(profile.combatPower),
    itemLevel: toInt(itemLevel),
  }
}

export function normalizeServers(raw: unknown): AionServer[] {
  const list = (raw as { serverList?: Array<Record<string, unknown>> })?.serverList ?? []
  return list.map((s) => ({
    id: toInt(s.serverId) ?? 0,
    name: String(s.serverName ?? ''),
    faction: factionFromRace(s.raceId),
  }))
}

// ---------------------------------------------------------------- chamadas

export async function searchCharacters(params: {
  region: Region
  name: string
  serverId?: number
  size?: number
}): Promise<AionSearchResult[]> {
  const url = new URL(SEARCH_URL)
  url.search = new URLSearchParams({
    keyword: params.name,
    page: '1',
    size: String(params.size ?? 30),
    localeInfo: 'en-US',
    region: params.region,
    ...(params.serverId ? { serverId: String(params.serverId) } : {}),
  }).toString()
  return normalizeSearch(await getJson(url.toString()), params.region)
}

export async function getCharacter(params: {
  region: Region
  serverId: number
  id: string
}): Promise<AionCharacter | null> {
  const url = new URL(INFO_URL)
  url.search = new URLSearchParams({
    lang: 'en-US',
    characterId: params.id,
    serverId: String(params.serverId),
    region: params.region,
  }).toString()
  return normalizeCharacter(await getJson(url.toString()), params.region)
}

export async function listServers(region: Region): Promise<AionServer[]> {
  const url = `${SERVERS_URL}?lang=en-US&region=${region}`
  return normalizeServers(await getJson(url))
}

// ---------------------------------------------------------------- helpers HTTP

/** Cache na CDN da Vercel: protege a API da NCSOFT de rajadas (429). */
export function json(body: unknown, cacheSeconds: number, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    },
  })
}

export function errorResponse(error: unknown): Response {
  const status = error instanceof AionApiError ? error.status : 502
  const message = error instanceof Error ? error.message : 'Falha ao consultar a API do Aion'
  return Response.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } })
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { 'cache-control': 'no-store' } })
}
