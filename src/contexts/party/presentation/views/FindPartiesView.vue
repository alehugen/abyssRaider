<script setup lang="ts">
import { PhArrowLeft, PhCircleNotch, PhMagnifyingGlass, PhWarningCircle } from '@phosphor-icons/vue'
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
import { findPartiesFor, type PartyMatch } from '../../application/findPartiesFor'
import { ROLE_ORDER } from '../../domain/Party'
import { usePartiesStore } from '../usePartiesStore'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()
const parties = usePartiesStore()
const repo = getContainer().partyRepository

if (!characters.loaded) void characters.load()

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

const matches = shallowRef<PartyMatch[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const requesting = ref<string | null>(null)
const requested = ref(new Set<string>())

async function search() {
  const linked = selected.value
  if (!linked) return
  loading.value = true
  error.value = null
  try {
    const candidates = await repo.listOpen({ region: linked.character.region, faction: linked.character.faction })
    matches.value = findPartiesFor(linked, candidates)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
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
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    requesting.value = null
  }
}

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
        Mostramos as parties da sua facção e região que ainda precisam do papel do seu personagem.
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

    <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-2xl" />
    </div>

    <div v-else-if="selected && !matches.length" class="space-y-2 rounded-2xl border border-dashed p-6 text-center">
      <PhMagnifyingGlass :size="28" class="mx-auto text-muted-foreground" />
      <p class="font-medium">Nenhuma party precisando de {{ rolesLabel(selected.character.className) || 'você' }} agora.</p>
      <p class="text-sm text-muted-foreground">
        Aplique o personagem em um santuário (em Meus personagens) para os líderes te encontrarem, ou crie sua própria party.
      </p>
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="m in matches"
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
          <p class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <span class="font-semibold text-success">Precisa de {{ roleList(m.needed) }}</span>
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
  </div>
</template>
