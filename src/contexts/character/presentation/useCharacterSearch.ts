import { ref, shallowRef, watch } from 'vue'
import { getContainer } from '@/app/container'
import { REGIONS, type CharacterSummary, type Region, type Server } from '../domain/Character'

const REGION_KEY = 'abyss-raider:region'

function savedRegion(): Region {
  try {
    const value = localStorage.getItem(REGION_KEY)
    if (value && (REGIONS as readonly string[]).includes(value)) return value as Region
  } catch {
    /* storage bloqueado */
  }
  return 'eu'
}

/** Estado da busca de personagens: região (lembrada), servidores, termo e resultados. */
export function useCharacterSearch() {
  const directory = getContainer().characterDirectory

  const region = ref<Region>(savedRegion())
  const serverId = ref<number | null>(null)
  const name = ref('')

  const servers = shallowRef<Server[]>([])
  const results = shallowRef<CharacterSummary[]>([])
  const searching = ref(false)
  const searched = ref(false)
  const error = ref<string | null>(null)

  async function loadServers(r: Region) {
    try {
      const list = await directory.servers(r)
      if (region.value === r) servers.value = list
    } catch {
      servers.value = [] // a busca funciona sem a lista; é só um filtro opcional
    }
  }

  watch(
    region,
    (r) => {
      try {
        localStorage.setItem(REGION_KEY, r)
      } catch {
        /* ignore */
      }
      serverId.value = null
      servers.value = []
      void loadServers(r)
    },
    { immediate: true },
  )

  let seq = 0
  async function search() {
    const term = name.value.trim()
    if (term.length < 2) {
      error.value = 'Digite ao menos 2 letras.'
      return
    }
    const current = ++seq
    searching.value = true
    error.value = null
    try {
      const found = await directory.search({
        region: region.value,
        name: term,
        ...(serverId.value ? { serverId: serverId.value } : {}),
      })
      if (current !== seq) return
      // A busca é aproximada: nomes exatos primeiro, depois maior nível.
      const exact = term.toLowerCase()
      results.value = [...found].sort(
        (a, b) =>
          Number(b.name.toLowerCase() === exact) - Number(a.name.toLowerCase() === exact) || b.level - a.level,
      )
      searched.value = true
    } catch (e) {
      if (current !== seq) return
      error.value = e instanceof Error ? e.message : String(e)
      results.value = []
    } finally {
      if (current === seq) searching.value = false
    }
  }

  return { region, serverId, name, servers, results, searching, searched, error, search }
}
