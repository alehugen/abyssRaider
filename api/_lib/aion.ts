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
  let res: Response
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; AbyssRaider)' },
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    throw timeout
      ? new AionApiError('A API do Aion demorou para responder. Tente de novo.', 504)
      : new AionApiError('Não foi possível falar com a API do Aion. Tente de novo.', 502)
  }
  if (res.status === 429) throw new AionApiError('A API do Aion está limitando requisições. Tente em instantes.', 429)
  if (res.status === 404) throw new AionApiError('Personagem não encontrado no Aion.', 404)
  if (!res.ok) throw new AionApiError(`A API do Aion está com problema (erro ${res.status}). Tente mais tarde.`, 502)
  try {
    return await res.json()
  } catch {
    // Às vezes a NCSOFT devolve uma página HTML (manutenção) com status 200.
    throw new AionApiError('A API do Aion respondeu algo inesperado (manutenção?). Tente mais tarde.', 502)
  }
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
  // Só mensagens nossas (em português) vão para a tela; o resto vai para o log.
  if (!(error instanceof AionApiError)) console.error(error)
  const message = error instanceof AionApiError ? error.message : 'Falha ao consultar a API do Aion. Tente de novo.'
  return Response.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } })
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { 'cache-control': 'no-store' } })
}

// ---------------------------------------------------------------- build (inspecionar)

/** Idioma da build: a API devolve nomes de itens e atributos como no cliente em português. */
const BUILD_LANG = 'pt-BR'
const EQUIPMENT_URL = 'https://aion2.plaync.com/api/character/equipment'
const ITEM_URL = 'https://aion2.plaync.com/api/character/equipment/item'

/** Atributos base; os demais (exceto ItemLevel) são os dos deuses (Daevanion). */
const BASE_STATS = new Set(['STR', 'DEX', 'INT', 'CON', 'AGI', 'WIS'])

export interface AionStat {
  type: string
  name: string
  value: number
  kind: 'base' | 'divine'
  effects: string[]
}

export interface AionGear {
  slot: number
  slotName: string
  itemId: number
  name: string
  grade: string
  icon: string | null
  enchantLevel: number
  exceedLevel: number
}

export interface AionSkill {
  id: number
  name: string
  icon: string | null
  category: 'active' | 'passive' | 'dp'
  level: number
  equipped: boolean
}

export interface AionBuild {
  itemLevel: number | null
  stats: AionStat[]
  daevanion: Array<{ id: number; name: string; icon: string | null; openNodes: number; totalNodes: number }>
  titles: Array<{ category: string; name: string; grade: string; effects: string[] }>
  equipment: AionGear[]
  pet: { name: string; icon: string | null; level: number } | null
  wing: { name: string; icon: string | null; grade: string; enchantLevel: number } | null
  skills: AionSkill[]
}

export interface AionItemDetail {
  name: string
  grade: string
  gradeName: string
  icon: string | null
  category: string
  level: number | null
  enchantLevel: number
  maxEnchantLevel: number | null
  mainStats: Array<{ name: string; value: string; extra: string | null }>
  subStats: Array<{ name: string; value: string }>
  skills: Array<{ name: string; icon: string | null; level: number }>
  manastones: Array<{ name: string; value: string; grade: string }>
}

type Obj = Record<string, unknown>
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : [])
const str = (v: unknown): string => (v == null ? '' : String(v))
const url = (v: unknown): string | null => (typeof v === 'string' && v.startsWith('http') ? v : null)
const descs = (v: unknown): string[] => arr(v).map((d) => str(d.desc)).filter(Boolean)

function skillCategory(v: unknown): AionSkill['category'] {
  if (v === 'Passive') return 'passive'
  if (v === 'Dp') return 'dp'
  return 'active'
}

export function normalizeBuild(info: unknown, equipment: unknown): AionBuild | null {
  const i = (info ?? {}) as Obj
  const e = (equipment ?? {}) as Obj
  if (!(i.profile as Obj | undefined)?.characterId) return null

  const statList = arr((i.stat as Obj | undefined)?.statList)
  const pw = (e.petwing ?? {}) as Obj
  const pet = (pw.pet ?? null) as Obj | null
  const wing = (pw.wing ?? null) as Obj | null

  return {
    itemLevel: toInt(statList.find((s) => s.type === 'ItemLevel')?.value),
    stats: statList
      .filter((s) => s.type !== 'ItemLevel')
      .map((s) => ({
        type: str(s.type),
        name: str(s.name),
        value: toInt(s.value) ?? 0,
        kind: BASE_STATS.has(str(s.type)) ? ('base' as const) : ('divine' as const),
        effects: Array.isArray(s.statSecondList) ? s.statSecondList.map(str) : [],
      })),
    daevanion: arr((i.daevanion as Obj | undefined)?.boardList)
      .filter((b) => b.open === 1)
      .map((b) => ({
        id: toInt(b.id) ?? 0,
        name: str(b.name),
        icon: url(b.icon),
        openNodes: toInt(b.openNodeCount) ?? 0,
        totalNodes: toInt(b.totalNodeCount) ?? 0,
      })),
    titles: arr((i.title as Obj | undefined)?.titleList).map((t) => ({
      category: str(t.equipCategory),
      name: str(t.name),
      grade: str(t.grade),
      effects: descs(t.equipStatList),
    })),
    equipment: arr((e.equipment as Obj | undefined)?.equipmentList)
      .map((q) => ({
        slot: toInt(q.slotPos) ?? 0,
        slotName: str(q.slotPosName),
        itemId: toInt(q.id) ?? 0,
        name: str(q.name),
        grade: str(q.grade),
        icon: url(q.icon),
        enchantLevel: toInt(q.enchantLevel) ?? 0,
        exceedLevel: toInt(q.exceedLevel) ?? 0,
      }))
      .sort((a, b) => a.slot - b.slot),
    pet: pet?.name ? { name: str(pet.name), icon: url(pet.icon), level: toInt(pet.level) ?? 0 } : null,
    wing: wing?.name
      ? { name: str(wing.name), icon: url(wing.icon), grade: str(wing.grade), enchantLevel: toInt(wing.enchantLevel) ?? 0 }
      : null,
    skills: arr((e.skill as Obj | undefined)?.skillList)
      .filter((s) => s.acquired === 1)
      .map((s) => ({
        id: toInt(s.id) ?? 0,
        name: str(s.name),
        icon: url(s.icon),
        category: skillCategory(s.category),
        level: toInt(s.skillLevel) ?? 0,
        equipped: s.equip === 1,
      })),
  }
}

export function normalizeItem(raw: unknown): AionItemDetail | null {
  const r = (raw ?? {}) as Obj
  if (!r.id) return null
  // "0" e "0%" significam sem bônus de encantamento.
  const extra = (v: unknown) => {
    const s = str(v)
    return s && s !== '0' && s !== '0%' ? s : null
  }
  return {
    name: str(r.name),
    grade: str(r.grade),
    gradeName: str(r.gradeName) || str(r.grade),
    icon: url(r.icon),
    category: str(r.categoryName),
    level: toInt(r.level),
    enchantLevel: toInt(r.enchantLevel) ?? 0,
    maxEnchantLevel: toInt(r.maxEnchantLevel),
    mainStats: arr(r.mainStats).map((s) => ({ name: str(s.name), value: str(s.value), extra: extra(s.extra) })),
    subStats: arr(r.subStats).map((s) => ({ name: str(s.name), value: str(s.value) })),
    skills: arr(r.subSkills).map((s) => ({ name: str(s.name), icon: url(s.icon), level: toInt(s.level) ?? 0 })),
    manastones: arr(r.magicStoneStat).map((s) => ({ name: str(s.name), value: str(s.value), grade: str(s.grade) })),
  }
}

export async function getBuild(params: { region: Region; serverId: number; id: string }): Promise<AionBuild | null> {
  const query = new URLSearchParams({
    lang: BUILD_LANG,
    characterId: params.id,
    serverId: String(params.serverId),
    region: params.region,
  }).toString()
  const [info, equipment] = await Promise.all([getJson(`${INFO_URL}?${query}`), getJson(`${EQUIPMENT_URL}?${query}`)])
  return normalizeBuild(info, equipment)
}

export async function getItem(params: {
  region: Region
  serverId: number
  id: string
  itemId: number
  slot: number
  enchantLevel: number
}): Promise<AionItemDetail | null> {
  const query = new URLSearchParams({
    id: String(params.itemId),
    enchantLevel: String(params.enchantLevel),
    characterId: params.id,
    serverId: String(params.serverId),
    slotPos: String(params.slot),
    lang: BUILD_LANG,
    region: params.region,
  }).toString()
  return normalizeItem(await getJson(`${ITEM_URL}?${query}`))
}
