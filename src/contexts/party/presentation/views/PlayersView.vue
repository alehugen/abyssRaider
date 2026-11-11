<script setup lang="ts">
import {
  PhCheck,
  PhCheckCircle,
  PhCircleNotch,
  PhClock,
  PhEye,
  PhMagnifyingGlass,
  PhUserPlus,
  PhUsersThree,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { watchDebounced } from '@vueuse/core'
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getContainer } from '@/app/container'
import {
  REGION_LABEL,
  REGIONS,
  ROLE_LABEL,
  rolesLabel,
  type CombatRole,
  type Faction,
  type Region,
} from '@/contexts/character/domain/Character'
import type { PlayerListing } from '@/contexts/character/domain/CharacterRepository'
import CharacterCard from '@/contexts/character/presentation/components/CharacterCard.vue'
import InspectCharacter from '@/contexts/character/presentation/inspect/InspectCharacter.vue'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { formatRow, routineFit, windowsToRows, type TimeWindow } from '@/contexts/scheduling/domain/Availability'
import { TZ_LABEL } from '@/shared/lib/brasilia'
import { errorMessage } from '@/shared/lib/errorMessage'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import { Input } from '@/shared/presentation/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/shared/presentation/ui/toggle-group'
import { inviteOptions, type InviteOption, type Membership } from '../../application/inviteOptions'
import { ROLE_ORDER } from '../../domain/Party'
import { WEEKDAYS } from '../../domain/RaidRoutine'
import { usePartiesStore } from '../usePartiesStore'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const parties = usePartiesStore()
const characters = useCharactersStore()
const { characterRepository, partyRepository, availabilityRepository } = getContainer()

if (!parties.loaded) void parties.load()
if (!characters.loaded) void characters.load()

// --- party para a qual se convida (?party=<id>; padrão: a primeira que lidera)
const led = computed(() => parties.items.filter((i) => i.myStatus === 'leader' && !i.party.finishedAt))
const partyId = computed({
  get: () => String(route.query.party ?? led.value[0]?.party.id ?? ''),
  set: (id: string) => void router.replace({ query: { ...route.query, party: id } }),
})
const target = computed(() => led.value.find((i) => i.party.id === partyId.value) ?? null)

// --- filtros
const filters = reactive({
  name: '',
  region: 'la' as Region,
  faction: '' as Faction | '',
  roles: [] as string[],
  minItemLevel: '',
  /** Dias da semana (string do ToggleGroup) em que o jogador precisa estar livre. */
  days: [] as string[],
})

// Preenche região e item level pela party (ou pelo seu personagem). Facção fica em "Todas": raid é entre facções.
const ready = ref(false)
watch(
  () => [parties.loaded || !!parties.error, characters.loaded || !!characters.error, target.value?.party.id] as const,
  ([pl, cl]) => {
    if (!pl || !cl) return
    const t = target.value?.party
    const mine = characters.items[0]?.character
    if (t) {
      filters.region = t.region
      filters.minItemLevel = t.sanctuary.minItemLevel ? String(t.sanctuary.minItemLevel) : ''
    } else if (!ready.value && mine) {
      filters.region = mine.region
    }
    ready.value = true
  },
  { immediate: true },
)

// --- busca
const results = shallowRef<PlayerListing[]>([])
const availability = shallowRef<Map<string, TimeWindow[]>>(new Map())
const memberships = ref<Membership[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

/** Só a busca mais recente vale (uma resposta lenta não sobrescreve a nova). */
let seq = 0

async function search() {
  if (!ready.value) return
  const mine = ++seq
  loading.value = true
  error.value = null
  try {
    const found = await characterRepository.searchPlayers({
      region: filters.region,
      faction: filters.faction || null,
      roles: filters.roles as CombatRole[],
      minItemLevel: Number(filters.minItemLevel) || null,
      name: filters.name,
      excludeOwnerId: auth.user?.id ?? null,
    })
    const [avail, ms] = await Promise.all([
      availabilityRepository.listByOwners(found.map((r) => r.linked.ownerId)),
      partyRepository.listMemberships(led.value.map((i) => i.party.id)),
    ])
    if (mine !== seq) return
    results.value = found
    availability.value = avail
    memberships.value = ms
  } catch (e) {
    if (mine === seq) error.value = errorMessage(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

watchDebounced(
  () => [ready.value, filters.name, filters.region, filters.faction, filters.roles.join(), filters.minItemLevel, led.value.length],
  () => void search(),
  { debounce: 300, immediate: true },
)

// --- linhas exibidas: filtro de dias (no navegador) e quem bate com a rotina primeiro
const rows = computed(() => {
  const days = filters.days.map(Number)
  const routine = target.value?.party.routine
  return results.value
    .map((r) => {
      const windows = availability.value.get(r.linked.ownerId) ?? []
      const fit = routine && windows.length ? routineFit(windows, routine) : null
      const option = target.value ? (inviteOptions([target.value], r.linked, memberships.value)[0] ?? null) : null
      return { ...r, windows, availabilityRows: windowsToRows(windows), fit, option }
    })
    .filter((r) => !days.length || r.windows.some((w) => days.includes(w.weekday)))
    .sort((a, b) => Number(!!b.fit?.free.length) - Number(!!a.fit?.free.length))
})

// --- convidar
const inviting = ref<string | null>(null)
const notice = ref<string | null>(null)

async function invite(option: InviteOption, r: PlayerListing) {
  inviting.value = r.linked.linkId
  error.value = null
  notice.value = null
  try {
    const result = await partyRepository.invite(option.summary.party.id, r.linked.linkId)
    const status = result === 'accepted' ? 'accepted' : 'invited'
    memberships.value = [
      ...memberships.value.filter((m) => !(m.partyId === option.summary.party.id && m.characterLinkId === r.linked.linkId)),
      { partyId: option.summary.party.id, characterLinkId: r.linked.linkId, ownerId: r.linked.ownerId, status },
    ]
    parties.invalidate()
    notice.value =
      status === 'accepted'
        ? `${r.linked.character.name} já tinha pedido vaga: entrou em ${option.summary.party.name}.`
        : `Convite enviado para ${r.linked.character.name}. Ele aceita pela lista de parties.`
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    inviting.value = null
  }
}

const number = new Intl.NumberFormat('pt-BR')
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-2">
      <h1 class="font-display text-4xl leading-tight font-bold">Jogadores</h1>
      <p class="max-w-prose text-muted-foreground">
        Personagens vinculados por outros jogadores, com a disponibilidade de cada um ({{ TZ_LABEL }}).
        <template v-if="led.length">Convide quem combina com a sua party.</template>
      </p>
    </header>

    <!-- Party para a qual convidar -->
    <div
      v-if="led.length"
      :class="cn(target && `faction-${target.party.faction}`, 'flex flex-wrap items-center gap-3 rounded-2xl border bg-card/60 p-3 sm:p-4')"
    >
      <PhUsersThree class="flex-none text-faction-ink" :size="20" aria-hidden="true" />
      <span id="target-label" class="text-sm font-medium">Convidando para</span>
      <Select v-model="partyId">
        <SelectTrigger class="w-full bg-background sm:w-72" aria-labelledby="target-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="i in led" :key="i.party.id" :value="i.party.id">
            {{ i.party.name }}
            <span class="text-muted-foreground">{{ i.acceptedCount }}/{{ i.party.sanctuary.groupSize }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <span v-if="target" class="text-[13px] text-muted-foreground">
        {{ target.party.sanctuary.name }},
        {{ REGION_LABEL[target.party.region] }}
      </span>
    </div>
    <p v-else-if="parties.loaded" class="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
      Para convidar alguém, <RouterLink :to="{ name: 'parties' }" class="font-medium text-foreground underline">crie uma party</RouterLink>
      primeiro. A busca funciona mesmo assim.
    </p>

    <!-- Filtros -->
    <form class="grid gap-3 rounded-2xl border bg-card/60 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4" role="search" @submit.prevent>
      <label class="space-y-1.5 lg:col-span-2">
        <span class="text-xs font-medium text-muted-foreground">Nome do personagem</span>
        <div class="relative">
          <PhMagnifyingGlass class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input v-model="filters.name" class="bg-background pl-9" placeholder="Buscar por nome" autocomplete="off" />
        </div>
      </label>

      <div class="space-y-1.5">
        <span id="region-label" class="text-xs font-medium text-muted-foreground">Região</span>
        <Select v-model="filters.region">
          <SelectTrigger class="w-full bg-background" aria-labelledby="region-label"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="r in REGIONS" :key="r" :value="r">{{ REGION_LABEL[r] }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label class="space-y-1.5">
        <span class="text-xs font-medium text-muted-foreground">Item level mínimo</span>
        <Input v-model="filters.minItemLevel" type="number" min="0" step="10" class="bg-background" placeholder="Qualquer" />
      </label>

      <fieldset class="space-y-1.5">
        <legend class="mb-1.5 text-xs font-medium text-muted-foreground">Facção</legend>
        <ToggleGroup
          :model-value="filters.faction || 'all'"
          type="single"
          variant="outline"
          class="w-full"
          @update:model-value="(v) => v && (filters.faction = (v === 'all' ? '' : v) as Faction | '')"
        >
          <ToggleGroupItem value="all" class="flex-1">Todas</ToggleGroupItem>
          <ToggleGroupItem value="elyos" class="flex-1">Elyos</ToggleGroupItem>
          <ToggleGroupItem value="asmodian" class="flex-1">Asmodian</ToggleGroupItem>
        </ToggleGroup>
      </fieldset>

      <fieldset class="space-y-1.5">
        <legend class="mb-1.5 text-xs font-medium text-muted-foreground">Papel</legend>
        <ToggleGroup v-model="filters.roles" type="multiple" variant="outline" class="w-full">
          <ToggleGroupItem v-for="r in ROLE_ORDER" :key="r" :value="r" class="flex-1 capitalize">{{ ROLE_LABEL[r] }}</ToggleGroupItem>
        </ToggleGroup>
      </fieldset>

      <fieldset class="space-y-1.5 sm:col-span-2">
        <legend class="mb-1.5 text-xs font-medium text-muted-foreground">Disponível em</legend>
        <ToggleGroup v-model="filters.days" type="multiple" variant="outline" class="grid w-full grid-cols-7">
          <ToggleGroupItem v-for="d in WEEKDAYS" :key="d.value" :value="String(d.value)" :aria-label="d.long" class="px-0 text-xs">
            {{ d.short }}
          </ToggleGroupItem>
        </ToggleGroup>
      </fieldset>
    </form>

    <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-destructive-ink">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>
    <p v-else-if="notice" role="status" class="flex items-center gap-2 text-sm text-success-ink">
      <PhCheckCircle :size="18" /> {{ notice }}
    </p>

    <!-- Resultados -->
    <div v-if="loading && !rows.length" class="grid gap-3 md:grid-cols-2" aria-busy="true">
      <div v-for="i in 4" :key="i" class="space-y-3 rounded-2xl border bg-card/60 p-4">
        <div class="flex items-center gap-3">
          <Skeleton class="size-11 rounded-lg" />
          <div class="flex-1 space-y-1.5">
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-3 w-56" />
          </div>
        </div>
        <Skeleton class="h-3 w-3/4" />
        <Skeleton class="h-8 w-32" />
      </div>
    </div>

    <div v-else-if="!rows.length" class="space-y-2 rounded-2xl border border-dashed p-6 text-center">
      <PhMagnifyingGlass :size="28" class="mx-auto text-muted-foreground" />
      <p class="font-medium">Nenhum jogador com esses filtros.</p>
      <p class="text-sm text-muted-foreground">Tente tirar o item level, o papel ou os dias.</p>
    </div>

    <template v-else>
      <p class="text-[13px] text-muted-foreground">
        {{ rows.length }} {{ rows.length === 1 ? 'personagem' : 'personagens' }}, maior item level primeiro
        <template v-if="target?.party.routine">; quem está livre no horário da party aparece antes</template>.
      </p>
      <ul :class="cn('grid gap-3 transition-opacity duration-200 md:grid-cols-2', loading && 'opacity-60')">
        <li
          v-for="r in rows"
          :key="r.linked.linkId"
          :class="cn(`faction-${r.linked.character.faction}`, 'flex flex-col gap-3 rounded-2xl border bg-card/60 p-4')"
        >
          <CharacterCard :character="r.linked.character" size="sm" :role="rolesLabel(r.linked.character.className)">
            <template #actions>
              <InspectCharacter :character="r.linked.character">
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 text-muted-foreground"
                  :aria-label="`Inspecionar ${r.linked.character.name}`"
                  :title="`Inspecionar ${r.linked.character.name}`"
                >
                  <PhEye />
                </Button>
              </InspectCharacter>
            </template>
          </CharacterCard>

          <div class="-mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
            <img v-if="r.ownerAvatarUrl" :src="r.ownerAvatarUrl" alt="" class="size-5 rounded-full" loading="lazy" />
            <span class="truncate">{{ r.ownerName }}</span>
            <span v-if="r.linked.character.itemLevel" class="ml-auto flex-none tabular-nums">
              item level <b class="font-semibold text-foreground">{{ number.format(r.linked.character.itemLevel) }}</b>
            </span>
          </div>

          <div class="text-[13px]">
            <p class="mb-0.5 flex items-center gap-1.5 font-medium">
              <PhClock class="text-muted-foreground" aria-hidden="true" /> Disponibilidade
            </p>
            <ul v-if="r.availabilityRows.length" class="space-y-0.5 pl-5">
              <li v-for="(row, i) in r.availabilityRows.slice(0, 3)" :key="i" class="first-letter:uppercase">{{ formatRow(row) }}</li>
              <li v-if="r.availabilityRows.length > 3" class="text-muted-foreground">
                e mais {{ r.availabilityRows.length - 3 }} {{ r.availabilityRows.length - 3 === 1 ? 'faixa' : 'faixas' }}
              </li>
            </ul>
            <p v-else class="pl-5 text-muted-foreground">Não informou.</p>
            <p v-if="r.fit?.free.length" class="mt-1 flex items-center gap-1.5 pl-5 font-medium text-success-ink">
              <PhCheckCircle aria-hidden="true" /> Livre no horário de {{ target?.party.name }}
            </p>
          </div>

          <div v-if="r.option" class="mt-auto flex items-center justify-end gap-2 border-t pt-3">
            <span v-if="r.option.state === 'blocked'" class="mr-auto text-[13px] text-muted-foreground">{{ r.option.reason }}</span>
            <span v-else-if="r.option.state === 'member'" class="flex items-center gap-1.5 text-sm font-medium text-success-ink">
              <PhCheck /> Na party
            </span>
            <span v-else-if="r.option.state === 'invited'" class="flex items-center gap-1.5 text-sm font-medium text-highlight-ink">
              <PhCheck /> Convidado, aguardando
            </span>
            <Button
              v-else
              size="sm"
              :variant="r.option.state === 'requested' ? 'default' : 'outline'"
              class="min-w-0 max-w-full"
              :disabled="inviting === r.linked.linkId"
              @click="invite(r.option, r)"
            >
              <PhCircleNotch v-if="inviting === r.linked.linkId" class="animate-spin" />
              <PhUserPlus v-else />
              <span class="truncate">{{
                r.option.state === 'requested' ? 'Pediu vaga: aceitar' : `Convidar para ${r.option.summary.party.name}`
              }}</span>
            </Button>
          </div>
        </li>
      </ul>
      <p v-if="results.length >= 60" class="text-center text-[13px] text-muted-foreground">
        Mostrando os 60 primeiros. Use os filtros para refinar.
      </p>
    </template>
  </div>
</template>
