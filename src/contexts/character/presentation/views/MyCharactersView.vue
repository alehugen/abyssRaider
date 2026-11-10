<script setup lang="ts">
import { PhArrowsClockwise, PhCircleNotch, PhTrash, PhUserCirclePlus, PhWarningCircle } from '@phosphor-icons/vue'
import { onMounted } from 'vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { Button } from '@/shared/presentation/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/presentation/ui/card'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import CharacterCard from '../components/CharacterCard.vue'
import CharacterSearch from '../components/CharacterSearch.vue'
import type { LinkedCharacter } from '../../domain/LinkedCharacter'
import { characterKey, useCharactersStore } from '../useCharactersStore'

const auth = useAuthStore()
const characters = useCharactersStore()

onMounted(() => {
  if (!characters.loaded) void characters.load()
})

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
function syncedLabel(date: Date): string {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

function confirmUnlink(linked: LinkedCharacter) {
  if (window.confirm(`Desvincular ${linked.character.name}?`)) void characters.unlink(linked)
}
</script>

<template>
  <div class="space-y-10">
    <section class="space-y-4">
      <header>
        <p class="text-sm text-muted-foreground">Olá, {{ auth.user?.displayName }}</p>
        <h1 class="font-display text-3xl font-bold">Meus personagens</h1>
      </header>

      <p v-if="characters.error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
        <PhWarningCircle :size="18" /> {{ characters.error }}
      </p>

      <div v-if="characters.loading && !characters.loaded" class="grid gap-4 md:grid-cols-2">
        <Skeleton v-for="i in 2" :key="i" class="h-32 rounded-[20px]" />
      </div>

      <Card v-else-if="!characters.items.length" class="border-2 border-dashed bg-transparent shadow-none">
        <CardHeader class="items-center text-center">
          <PhUserCirclePlus :size="36" class="mx-auto text-muted-foreground" />
          <CardTitle>Nenhum personagem vinculado</CardTitle>
          <CardDescription>Busque seu personagem abaixo para usá-lo nas parties.</CardDescription>
        </CardHeader>
      </Card>

      <ul v-else class="grid gap-4 md:grid-cols-2">
        <li v-for="linked in characters.items" :key="linked.linkId">
          <CharacterCard :character="linked.character">
            <template #actions>
              <div class="flex flex-col items-end gap-1">
                <div class="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    :aria-label="`Atualizar ${linked.character.name}`"
                    :disabled="characters.isPending(characterKey(linked.character))"
                    @click="characters.refresh(linked)"
                  >
                    <PhCircleNotch v-if="characters.isPending(characterKey(linked.character))" class="animate-spin" />
                    <PhArrowsClockwise v-else />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive"
                    :aria-label="`Desvincular ${linked.character.name}`"
                    :disabled="characters.isPending(linked.linkId)"
                    @click="confirmUnlink(linked)"
                  >
                    <PhTrash />
                  </Button>
                </div>
                <span class="text-xs text-muted-foreground" :title="linked.syncedAt.toLocaleString('pt-BR')">
                  {{ syncedLabel(linked.syncedAt) }}
                </span>
              </div>
            </template>
          </CharacterCard>
        </li>
      </ul>
    </section>

    <CharacterSearch />
  </div>
</template>
