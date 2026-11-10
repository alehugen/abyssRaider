<script setup lang="ts">
import {
  PhArrowsClockwise,
  PhCircleNotch,
  PhMagnifyingGlass,
  PhTrash,
  PhUserPlus,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { onMounted, ref, watch } from 'vue'
import SanctuaryApplications from '@/contexts/party/presentation/components/SanctuaryApplications.vue'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
import { Button } from '@/shared/presentation/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/presentation/ui/dialog'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/presentation/ui/tooltip'
import CharacterCard from '../components/CharacterCard.vue'
import CharacterSearch from '../components/CharacterSearch.vue'
import { MAX_CHARACTERS_PER_ACCOUNT, type LinkedCharacter } from '../../domain/LinkedCharacter'
import { characterKey, useCharactersStore } from '../useCharactersStore'

const characters = useCharactersStore()
const adding = ref(false)

onMounted(() => {
  if (!characters.loaded) void characters.load()
})

// Vinculou pelo diálogo: fecha para mostrar o card novo.
watch(
  () => characters.items.length,
  (now, before) => {
    if (adding.value && now > before) adding.value = false
  },
)

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
function syncedLabel(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'Atualizado agora'
  if (minutes < 60) return `Atualizado ${relative.format(-minutes, 'minute')}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Atualizado ${relative.format(-hours, 'hour')}`
  return `Atualizado ${relative.format(-Math.round(hours / 24), 'day')}`
}

async function confirmUnlink(linked: LinkedCharacter) {
  const ok = await confirm({
    title: `Desvincular ${linked.character.name}?`,
    description: 'Ele sai das parties e das aplicações em santuários; parties que ele lidera são excluídas. Você pode vincular de novo depois.',
    confirmText: 'Desvincular',
    destructive: true,
  })
  if (ok) void characters.unlink(linked)
}
</script>

<template>
  <div class="space-y-10">
    <section class="space-y-5" aria-labelledby="roster-title">
      <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 id="roster-title" class="font-display text-4xl leading-tight font-bold">Meus personagens</h1>
          <p v-if="characters.loaded" class="text-sm text-muted-foreground tabular-nums">
            {{ characters.items.length }} de {{ MAX_CHARACTERS_PER_ACCOUNT }} vinculados
          </p>
        </div>

        <Tooltip v-if="characters.items.length">
          <TooltipTrigger as-child>
            <Button
              size="icon"
              variant="outline"
              aria-label="Adicionar personagem"
              :disabled="characters.items.length >= MAX_CHARACTERS_PER_ACCOUNT"
              @click="adding = true"
            >
              <PhUserPlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Adicionar personagem</TooltipContent>
        </Tooltip>
      </header>

      <p v-if="characters.error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
        <PhWarningCircle :size="18" /> {{ characters.error }}
      </p>

      <div v-if="characters.loading && !characters.loaded" class="grid gap-4 lg:grid-cols-2">
        <Skeleton v-for="i in 2" :key="i" class="h-36 rounded-2xl" />
      </div>

      <ul v-else-if="characters.items.length" class="grid gap-5 lg:grid-cols-2">
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
            <template #footer>
              <div class="flex flex-wrap items-center gap-2">
                <SanctuaryApplications :linked="linked" />
                <Button size="sm" variant="ghost" as-child>
                  <RouterLink :to="{ name: 'find-parties', query: { personagem: linked.linkId } }">
                    <PhMagnifyingGlass /> Buscar parties
                  </RouterLink>
                </Button>
              </div>
            </template>
          </CharacterCard>
        </li>
      </ul>
    </section>

    <!-- Sem personagem: a busca é o conteúdo principal da página. -->
    <CharacterSearch v-if="characters.loaded && !characters.items.length" />

    <Dialog v-model:open="adding">
      <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle class="font-display text-2xl">Adicionar personagem</DialogTitle>
          <DialogDescription>
            Escolha a região e digite o nome como aparece no jogo. Os dados vêm do site oficial do Aion 2.
          </DialogDescription>
        </DialogHeader>
        <CharacterSearch embedded />
      </DialogContent>
    </Dialog>
  </div>
</template>
