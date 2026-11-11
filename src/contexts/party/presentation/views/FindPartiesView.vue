<script setup lang="ts">
import { errorMessage } from '@/shared/lib/errorMessage'
import {
  PhArrowLeft,
  PhCheckCircle,
  PhCircleNotch,
  PhClock,
  PhMagnifyingGlass,
  PhUsersThree,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getContainer } from '@/app/container'
import { REGION_LABEL, ROLE_LABEL, rolesLabel } from '@/contexts/character/domain/Character'
import ClassIcon from '@/contexts/character/presentation/components/ClassIcon.vue'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { findPartiesFor, type PartyMatch, type PartySearch } from '../../application/findPartiesFor'
import { ROLE_ORDER } from '../../domain/Party'
import { usePartiesStore } from '../usePartiesStore'
import { formatRoutine } from '../routineFormat'
import { routineFit } from '@/contexts/scheduling/domain/Availability'
import { useAvailabilityStore } from '@/contexts/scheduling/presentation/useAvailabilityStore'
import AvailabilityDialog from '@/contexts/scheduling/presentation/components/AvailabilityDialog.vue'
import { WEEKDAYS } from '../../domain/RaidRoutine'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()
const parties = usePartiesStore()
const repo = getContainer().partyRepository

if (!characters.loaded) void characters.load()
const availability = useAvailabilityStore()
void availability.load()

/** O personagem escolhido fica na URL (?personagem=linkId) para o link poder ser compartilhado/recarregado. */
const selectedId = computed({
  get: () => String(route.query.personagem ?? ''),
  set: (id: string) => void router.replace({ query: { ...route.query, personagem: id } }),
})
const selected = computed(() => characters.items.find((l) => l.linkId === selectedId.value) ?? null)

watch(
  () => characters.items,
  (items) => {
    if (!selected.value && items[0]) selectedId.value = items[0].linkId
  },
  { immediate: true },
)

const result = shallowRef<PartySearch>({ needYou: [], noRoleSlot: [], mine: [] })
const loading = ref(false)
const error = ref<string | null>(null)
const requesting = ref<string | null>(null)
const requested = ref(new Set<string>())

/** Só a busca do personagem selecionado agora vale (trocar rápido não mistura resultados). */
let seq = 0

async function search() {
  const linked = selected.value
  if (!linked) return
  const mine = ++seq
  loading.value = true
  error.value = null
  try {
    const candidates = await repo.listOpen({ region: linked.character.region, faction: linked.character.faction })
    if (mine !== seq) return
    result.value = findPartiesFor(linked, candidates)
  } catch (e) {
    if (mine === seq) error.value = errorMessage(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch(selected, () => void search(), { immediate: true })

async function requestJoin(match: PartyMatch) {
  const linked = selected.value
  if (!linked) return
  requesting.value = match.details.party.id
  error.value = null
  try {
    await repo.requestJoin(match.details.party.id, linked.linkId, linked.ownerId)
    requested.value = new Set(requested.value).add(match.details.party.id)
    parties.invalidate()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    requesting.value = null
  }
}

/**
 * Parties cuja rotina bate com a disponibilidade vêm primeiro (mantendo a
 * ordem por papel entre elas). Sem disponibilidade informada, nada muda.
 */
function ranked(matches: readonly PartyMatch[]) {
  const mine = availability.windows
  const list = matches.map((m) => {
    const routine = m.details.party.routine
    const fit = mine.length && routine ? routineFit(mine, routine) : null
    return { match: m, fit }
  })
  if (!mine.length) return list
  return list
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => Number(!!b.fit?.free.length) - Number(!!a.fit?.free.length) || a.i - b.i)
}

const roleName = computed(() => (selected.value ? rolesLabel(selected.value.character.className) || 'você' : ''))
const sections = computed(() =>
  [
    { key: 'needYou', title: `Precisam de ${roleName.value}`, hint: null, items: ranked(result.value.needYou) },
    {
      key: 'noRoleSlot',
      title: `Sem vaga de ${roleName.value}`,
      hint: 'A formação já tem esse papel, mas você ainda pode pedir: o líder decide.',
      items: ranked(result.value.noRoleSlot),
    },
  ].filter((s) => s.items.length),
)
const total = computed(() => result.value.needYou.length + result.value.noRoleSlot.length)
const dayList = (days: readonly number[]) => days.map((d) => WEEKDAYS[d]!.short.toLowerCase()).join(', ')

const roleList = (roles: readonly string[]) => roles.map((r) => ROLE_LABEL[r as keyof typeof ROLE_LABEL]).join(' ou ')
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="{ name: 'parties' }"
      class="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
    >
      <PhArrowLeft /> Parties
    </RouterLink>

    <header class="space-y-2">
      <h1 class="font-display text-4xl leading-tight font-bold">Buscar parties</h1>
      <p class="max-w-prose text-muted-foreground">
        Parties da sua facção e região: primeiro as que precisam do papel do seu personagem, depois as que já têm
        esse papel completo.
      </p>
    </header>

    <p v-if="characters.loaded && !characters.items.length" class="text-muted-foreground">
      Vincule um personagem em
      <RouterLink to="/me" class="font-medium text-foreground underline">Meus personagens</RouterLink>
      para buscar parties.
    </p>

    <div v-else class="flex flex-wrap items-center gap-3">
      <Select v-model="selectedId">
        <SelectTrigger class="w-full bg-background sm:w-80" aria-label="Personagem">
          <SelectValue placeholder="Escolha o personagem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="l in characters.items" :key="l.linkId" :value="l.linkId">
            {{ l.character.name }}
            <span class="text-muted-foreground">{{ l.character.className }}, {{ rolesLabel(l.character.className) }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <p v-if="selected" class="flex items-center gap-2 text-sm text-muted-foreground">
        <span :class="`faction-${selected.character.faction}`"><ClassIcon :class-name="selected.character.className" /></span>
        Procurando vaga de {{ rolesLabel(selected.character.className) || 'qualquer papel' }} em
        {{ REGION_LABEL[selected.character.region] }}
      </p>
    </div>

    <p v-if="error || characters.error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" aria-hidden="true" /> {{ error ?? characters.error }}
    </p>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-2xl" />
    </div>

    <template v-else-if="selected">
      <!-- Parties em que a conta já está (não entram nas listas) -->
      <div v-if="result.mine.length" class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted/60 p-3 text-sm">
        <PhUsersThree class="text-muted-foreground" aria-hidden="true" />
        <span>Você já está {{ result.mine.length === 1 ? 'nesta party' : 'nestas parties' }} da região:</span>
        <template v-for="(d, i) in result.mine" :key="d.party.id">
          <RouterLink :to="{ name: 'party', params: { id: d.party.id } }" class="font-medium underline">{{ d.party.name }}</RouterLink>
          <span v-if="d.party.leaderId === selected.ownerId" class="text-muted-foreground">(líder)</span><template
            v-if="i < result.mine.length - 1"
            >,</template
          >
        </template>
      </div>

      <div v-if="!total" class="space-y-2 rounded-2xl border border-dashed p-6 text-center">
        <PhMagnifyingGlass :size="28" class="mx-auto text-muted-foreground" />
        <p class="font-medium">
          {{ result.mine.length ? 'Nenhuma outra party aberta na sua região agora.' : 'Nenhuma party aberta na sua região agora.' }}
        </p>
        <p class="text-sm text-muted-foreground">Tente de novo mais tarde ou crie sua própria party.</p>
      </div>

      <div
        v-if="availability.loaded && !availability.windows.length && total"
        class="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm"
      >
        <PhClock class="text-muted-foreground" aria-hidden="true" />
        <span class="flex-1">Informe sua disponibilidade para ver quais parties batem com seus horários.</span>
        <AvailabilityDialog>
          <Button size="sm" variant="outline">Informar disponibilidade</Button>
        </AvailabilityDialog>
      </div>

      <section v-for="section in sections" :key="section.key" :aria-labelledby="`${section.key}-title`" class="space-y-3">
        <div>
          <h2 :id="`${section.key}-title`" class="font-display text-2xl font-semibold">
            {{ section.title }} <span class="text-muted-foreground tabular-nums">{{ section.items.length }}</span>
          </h2>
          <p v-if="section.hint" class="text-sm text-muted-foreground">{{ section.hint }}</p>
        </div>
        <ul class="space-y-3">
          <li
            v-for="{ match: m, fit } in section.items"
            :key="m.details.party.id"
            :class="
              cn(
                `faction-${m.details.party.faction}`,
                'flex flex-wrap items-center gap-4 rounded-2xl border bg-card/60 p-4 sm:flex-nowrap sm:p-5',
              )
            "
          >
            <span class="h-12 w-0.75 flex-none rounded-full bg-faction" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <RouterLink
                :to="{ name: 'party', params: { id: m.details.party.id } }"
                class="block truncate font-display text-xl font-semibold hover:underline"
              >
                {{ m.details.party.name }}
              </RouterLink>
              <p class="text-sm text-muted-foreground">
                {{ m.details.party.sanctuary.name }}, {{ m.acceptedCount }}/{{ m.details.party.sanctuary.groupSize }}
                membros
              </p>
              <p v-if="m.details.party.routine" class="text-sm first-letter:uppercase">
                {{ formatRoutine(m.details.party.routine) }}
              </p>
              <p v-if="fit && fit.free.length" class="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-success">
                <PhCheckCircle aria-hidden="true" />
                Bate com sua disponibilidade{{ fit.busy.length ? ` (${dayList(fit.free)})` : '' }}
              </p>
              <p v-else-if="fit" class="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <PhClock aria-hidden="true" /> Fora da sua disponibilidade
              </p>
              <p class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <span v-if="m.needed.length" class="font-semibold text-success">Precisa de {{ roleList(m.needed) }}</span>
                <span v-else class="font-semibold text-muted-foreground">Sem vaga de {{ roleName }}</span>
                <span class="text-muted-foreground">
                  Vagas:
                  <template v-for="(r, i) in ROLE_ORDER" :key="r">
                    {{ m.open[r] }} {{ ROLE_LABEL[r] }}<template v-if="i < ROLE_ORDER.length - 1">, </template>
                  </template>
                </span>
              </p>
            </div>
            <Button
              v-if="!requested.has(m.details.party.id)"
              :variant="m.needed.length ? 'default' : 'outline'"
              :disabled="requesting === m.details.party.id"
              class="w-full sm:w-auto"
              @click="requestJoin(m)"
            >
              <PhCircleNotch v-if="requesting === m.details.party.id" class="animate-spin" />
              Pedir vaga
            </Button>
            <span v-else class="w-full text-sm font-medium text-success sm:w-auto">Pedido enviado</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
