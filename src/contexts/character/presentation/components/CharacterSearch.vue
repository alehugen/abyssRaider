<script setup lang="ts">
import { PhCheck, PhCircleNotch, PhLink, PhMagnifyingGlass, PhWarningCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { REGIONS, REGION_LABEL, type CharacterSummary, type Region } from '@/contexts/character/domain/Character'
import { Button } from '@/shared/presentation/ui/button'
import { Input } from '@/shared/presentation/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { characterKey, useCharactersStore } from '../useCharactersStore'
import { useCharacterSearch } from '../useCharacterSearch'
import CharacterCard from './CharacterCard.vue'

const { region, serverId, name, servers, results, searching, searched, error, search } = useCharacterSearch()
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

function link(c: CharacterSummary) {
  void characters.link({ region: c.region, serverId: c.serverId, id: c.id })
}
</script>

<template>
  <section class="space-y-4" aria-labelledby="search-title">
    <h2 id="search-title" class="font-display text-xl font-bold">Vincular personagem</h2>

    <form class="grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,11rem)_1fr_auto]" @submit.prevent="search">
      <Select v-model="regionValue">
        <SelectTrigger class="w-full" aria-label="Região">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="r in REGIONS" :key="r" :value="r">{{ REGION_LABEL[r] }}</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="serverValue">
        <SelectTrigger class="w-full" aria-label="Servidor">
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

      <Input v-model="name" placeholder="Nome do personagem" aria-label="Nome do personagem" maxlength="32" autocomplete="off" />

      <Button type="submit" :disabled="searching">
        <PhCircleNotch v-if="searching" class="animate-spin" />
        <PhMagnifyingGlass v-else />
        Buscar
      </Button>
    </form>

    <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>

    <div v-if="searching" class="grid gap-3 sm:grid-cols-2">
      <Skeleton v-for="i in 4" :key="i" class="h-[74px] rounded-[20px]" />
    </div>

    <template v-else-if="searched">
      <p v-if="!results.length" class="text-sm text-muted-foreground">
        Nenhum personagem encontrado. Confira a região e o nome.
      </p>
      <ul v-else class="grid gap-3 sm:grid-cols-2">
        <li v-for="c in results" :key="characterKey(c)">
          <CharacterCard :character="c" size="sm">
            <template #actions>
              <Button v-if="characters.linkedKeys.has(characterKey(c))" size="sm" variant="ghost" disabled>
                <PhCheck /> Vinculado
              </Button>
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
  </section>
</template>
