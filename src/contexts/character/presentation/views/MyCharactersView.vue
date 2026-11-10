<script setup lang="ts">
import { PhArrowsClockwise, PhCircleNotch, PhTrash, PhWarningCircle } from '@phosphor-icons/vue'
import { onMounted } from 'vue'
import { Button } from '@/shared/presentation/ui/button'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import CharacterCard from '../components/CharacterCard.vue'
import CharacterSearch from '../components/CharacterSearch.vue'
import { MAX_CHARACTERS_PER_ACCOUNT, type LinkedCharacter } from '../../domain/LinkedCharacter'
import { characterKey, useCharactersStore } from '../useCharactersStore'

const characters = useCharactersStore()

onMounted(() => {
  if (!characters.loaded) void characters.load()
})

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
function syncedLabel(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'Atualizado agora'
  if (minutes < 60) return `Atualizado ${relative.format(-minutes, 'minute')}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Atualizado ${relative.format(-hours, 'hour')}`
  return `Atualizado ${relative.format(-Math.round(hours / 24), 'day')}`
}

function confirmUnlink(linked: LinkedCharacter) {
  if (window.confirm(`Desvincular ${linked.character.name} da sua conta?`)) void characters.unlink(linked)
}
</script>

<template>
  <div class="space-y-10">
    <section class="space-y-5" aria-labelledby="roster-title">
      <header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h1 id="roster-title" class="font-display text-4xl leading-none font-bold">Meus personagens</h1>
        <p v-if="characters.loaded" class="text-sm text-muted-foreground tabular-nums">
          {{ characters.items.length }} de {{ MAX_CHARACTERS_PER_ACCOUNT }} vinculados
        </p>
      </header>

      <p v-if="characters.error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
        <PhWarningCircle :size="18" /> {{ characters.error }}
      </p>

      <div v-if="characters.loading && !characters.loaded" class="grid gap-4 lg:grid-cols-2">
        <Skeleton v-for="i in 2" :key="i" class="h-36 rounded-2xl" />
      </div>

      <p v-else-if="!characters.items.length" class="text-muted-foreground">
        Você ainda não vinculou nenhum personagem. Busque o seu abaixo para poder entrar em parties.
      </p>

      <ul v-else class="grid gap-4 lg:grid-cols-2">
        <li v-for="linked in characters.items" :key="linked.linkId">
          <CharacterCard :character="linked.character" :footnote="syncedLabel(linked.syncedAt)">
            <template #actions>
              <Button
                size="icon"
                variant="ghost"
                class="size-8 text-muted-foreground"
                :title="`Atualizar dados de ${linked.character.name}`"
                :aria-label="`Atualizar dados de ${linked.character.name}`"
                :disabled="characters.isPending(characterKey(linked.character))"
                @click="characters.refresh(linked)"
              >
                <PhCircleNotch v-if="characters.isPending(characterKey(linked.character))" class="animate-spin" />
                <PhArrowsClockwise v-else />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-8 text-muted-foreground hover:text-destructive"
                :title="`Desvincular ${linked.character.name}`"
                :aria-label="`Desvincular ${linked.character.name}`"
                :disabled="characters.isPending(linked.linkId)"
                @click="confirmUnlink(linked)"
              >
                <PhTrash />
              </Button>
            </template>
          </CharacterCard>
        </li>
      </ul>
    </section>

    <CharacterSearch />
  </div>
</template>
