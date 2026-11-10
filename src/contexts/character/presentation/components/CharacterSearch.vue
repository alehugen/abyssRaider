<script setup lang="ts">
import { PhCheck, PhCircleNotch, PhLink, PhLock, PhMagnifyingGlass, PhWarningCircle } from '@phosphor-icons/vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/presentation/ui/tooltip'
import { computed } from 'vue'
import { REGIONS, REGION_LABEL, type CharacterSummary, type Region } from '@/contexts/character/domain/Character'
import { Button } from '@/shared/presentation/ui/button'
import { Input } from '@/shared/presentation/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { characterKey, useCharactersStore } from '../useCharactersStore'
import { useCharacterSearch } from '../useCharacterSearch'
import CharacterCard from './CharacterCard.vue'

/** embedded = dentro de um diálogo: sem moldura nem título próprios. */
defineProps<{ embedded?: boolean }>()

const { region, serverId, name, servers, results, searching, searched, error, search, ownerOf } = useCharacterSearch()
const auth = useAuthStore()

/** Vinculado por outra conta: aparece na busca, mas bloqueado. */
const claimedByOther = (c: CharacterSummary) => {
  const owner = ownerOf(c)
  return owner !== null && owner !== auth.user?.id
}
const characters = useCharactersStore()

const ALL = 'all'
const serverValue = computed({
  get: () => (serverId.value ? String(serverId.value) : ALL),
  set: (v: string) => (serverId.value = v === ALL ? null : Number(v)),
})
const regionValue = computed({
  get: () => region.value,
  set: (v: string) => (region.value = v as Region),
})
const byFaction = computed(() => ({
  elyos: servers.value.filter((s) => s.faction === 'elyos'),
  asmodian: servers.value.filter((s) => s.faction === 'asmodian'),
}))
const resultCount = computed(() =>
  results.value.length === 1 ? '1 personagem encontrado' : `${results.value.length} personagens encontrados`,
)

function link(c: CharacterSummary) {
  void characters.link({ region: c.region, serverId: c.serverId, id: c.id })
}
</script>

<template>
  <section
    :class="embedded ? '' : 'rounded-2xl border bg-card/60 p-4 sm:p-6'"
    :aria-labelledby="embedded ? undefined : 'search-title'"
    :aria-label="embedded ? 'Buscar personagem' : undefined"
  >
    <div v-if="!embedded" class="max-w-prose">
      <h2 id="search-title" class="font-display text-2xl font-semibold">Vincular personagem</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Escolha a região e digite o nome como aparece no jogo. Os dados vêm do site oficial do Aion 2.
      </p>
    </div>

    <form
      :class="embedded ? '' : 'mt-5'"
      class="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_1fr_auto]"
      role="search"
      @submit.prevent="search"
    >
      <Select v-model="regionValue">
        <SelectTrigger class="w-full bg-background" aria-label="Região">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="r in REGIONS" :key="r" :value="r">{{ REGION_LABEL[r] }}</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="serverValue">
        <SelectTrigger class="w-full bg-background" aria-label="Servidor">
          <SelectValue placeholder="Todos os servidores" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL">Todos os servidores</SelectItem>
          <SelectGroup v-if="byFaction.elyos.length">
            <SelectLabel>Elyos</SelectLabel>
            <SelectItem v-for="s in byFaction.elyos" :key="s.id" :value="String(s.id)">{{ s.name }}</SelectItem>
          </SelectGroup>
          <SelectGroup v-if="byFaction.asmodian.length">
            <SelectLabel>Asmodian</SelectLabel>
            <SelectItem v-for="s in byFaction.asmodian" :key="s.id" :value="String(s.id)">{{ s.name }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Input
        v-model="name"
        class="bg-background"
        placeholder="Nome do personagem"
        aria-label="Nome do personagem"
        maxlength="32"
        autocomplete="off"
      />

      <Button type="submit" :disabled="searching">
        <PhCircleNotch v-if="searching" class="animate-spin" />
        <PhMagnifyingGlass v-else />
        Buscar
      </Button>
    </form>

    <p v-if="error" role="alert" class="mt-3 flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>

    <div v-if="searching" class="mt-4 divide-y divide-border/60" aria-busy="true">
      <div v-for="i in 4" :key="i" class="flex items-center gap-3 py-2.5">
        <Skeleton class="size-11 rounded-lg" />
        <div class="space-y-1.5">
          <Skeleton class="h-4 w-32" />
          <Skeleton class="h-3 w-48" />
        </div>
      </div>
    </div>

    <template v-else-if="searched">
      <p v-if="!results.length" class="mt-4 text-sm text-muted-foreground">
        Nenhum personagem com esse nome em {{ REGION_LABEL[region] }}. Confira a grafia ou troque a região.
      </p>
      <template v-else>
        <p class="mt-5 text-xs text-muted-foreground" aria-live="polite">{{ resultCount }}</p>
        <ul class="mt-1 divide-y divide-border/60">
          <li v-for="c in results" :key="characterKey(c)">
            <CharacterCard :character="c" size="sm" :inactive="claimedByOther(c)">
              <template #actions>
                <span
                  v-if="characters.linkedKeys.has(characterKey(c))"
                  class="flex items-center gap-1.5 px-3 text-sm font-medium text-success"
                >
                  <PhCheck weight="bold" /> Vinculado
                </span>
                <Tooltip v-else-if="claimedByOther(c)">
                  <TooltipTrigger as-child>
                    <span
                      tabindex="0"
                      class="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
                    >
                      <PhLock weight="bold" /> Já vinculado
                    </span>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-60">
                    Este personagem já está vinculado a outra conta do AbyssRaider.
                  </TooltipContent>
                </Tooltip>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="characters.isPending(characterKey(c))"
                  @click="link(c)"
                >
                  <PhCircleNotch v-if="characters.isPending(characterKey(c))" class="animate-spin" />
                  <PhLink v-else />
                  Vincular
                </Button>
              </template>
            </CharacterCard>
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>
