<script setup lang="ts">
import {
  PhArrowsClockwise,
  PhCircleNotch,
  PhEye,
  PhMagnifyingGlass,
  PhTrash,
  PhTrendUp,
  PhUserPlus,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { onMounted, ref, watch } from 'vue'
import { t } from '@/shared/i18n'
import { relativeFormat } from '@/shared/i18n/format'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
import InspectCharacter from '../inspect/InspectCharacter.vue'
import StrengthPathDialog from '../strength/StrengthPathDialog.vue'
import AvailabilityCard from '@/contexts/scheduling/presentation/components/AvailabilityCard.vue'
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

function syncedLabel(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return t('character.my.syncedNow')
  const ago = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
    t('character.my.syncedAgo', { when: relativeFormat().format(-value, unit) })
  if (minutes < 60) return ago(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return ago(hours, 'hour')
  return ago(Math.round(hours / 24), 'day')
}

async function confirmUnlink(linked: LinkedCharacter) {
  const ok = await confirm({
    title: t('character.my.unlinkTitle', { name: linked.character.name }),
    description: t('character.my.unlinkDescription'),
    confirmText: t('character.my.unlinkConfirm'),
    destructive: true,
  })
  if (ok) void characters.unlink(linked)
}
</script>

<template>
  <div class="space-y-10">
    <AvailabilityCard v-if="characters.items.length" />
    <!-- Reserva o espaço do card enquanto carrega (sem empurrar a página depois). -->
    <Skeleton v-else-if="!characters.loaded" class="h-28 rounded-2xl" />

    <section class="space-y-5" aria-labelledby="roster-title">
      <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 id="roster-title" class="font-display text-4xl leading-tight font-bold">{{ t('character.my.title') }}</h1>
          <p v-if="characters.loaded" class="text-sm text-muted-foreground tabular-nums">
            {{ t('character.my.count', { n: characters.items.length, max: MAX_CHARACTERS_PER_ACCOUNT }) }}
          </p>
        </div>

        <Tooltip v-if="characters.items.length">
          <TooltipTrigger as-child>
            <Button
              size="icon"
              variant="outline"
              :aria-label="t('character.my.add')"
              :disabled="characters.items.length >= MAX_CHARACTERS_PER_ACCOUNT"
              @click="adding = true"
            >
              <PhUserPlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('character.my.add') }}</TooltipContent>
        </Tooltip>
      </header>

      <p v-if="characters.error" role="alert" class="flex items-center gap-2 text-sm text-destructive-ink">
        <PhWarningCircle :size="18" /> {{ characters.error }}
      </p>

      <div v-if="characters.loading && !characters.loaded" class="grid gap-4 lg:grid-cols-2">
        <Skeleton v-for="i in 2" :key="i" class="h-48 rounded-2xl" />
      </div>

      <ul v-else-if="characters.items.length" class="grid gap-5 lg:grid-cols-2">
        <li v-for="linked in characters.items" :key="linked.linkId">
          <CharacterCard :character="linked.character" :footnote="syncedLabel(linked.syncedAt)">
            <template #actions>
              <Button
                size="icon"
                variant="ghost"
                class="size-8 text-muted-foreground"
                :title="t('character.my.refresh', { name: linked.character.name })"
                :aria-label="t('character.my.refresh', { name: linked.character.name })"
                :disabled="characters.isPending(characterKey(linked.character))"
                @click="characters.refresh(linked)"
              >
                <PhCircleNotch v-if="characters.isPending(characterKey(linked.character))" class="animate-spin" />
                <PhArrowsClockwise v-else />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-8 text-muted-foreground hover:text-destructive-ink"
                :title="t('character.my.unlink', { name: linked.character.name })"
                :aria-label="t('character.my.unlink', { name: linked.character.name })"
                :disabled="characters.isPending(linked.linkId)"
                @click="confirmUnlink(linked)"
              >
                <PhTrash />
              </Button>
            </template>
            <template #aside>
              <StrengthPathDialog :character="linked.character">
                <Button size="sm" variant="outline" class="h-7 px-2.5 text-xs">
                  <PhTrendUp /> {{ t('character.strength.title') }}
                </Button>
              </StrengthPathDialog>
            </template>
            <template #footer>
              <div class="flex flex-wrap items-center gap-2">
                <InspectCharacter :character="linked.character">
                  <Button size="sm" variant="ghost"><PhEye /> {{ t('character.my.inspect') }}</Button>
                </InspectCharacter>
                <Button size="sm" variant="ghost" as-child>
                  <RouterLink :to="{ name: 'find-parties', query: { personagem: linked.linkId } }">
                    <PhMagnifyingGlass /> {{ t('character.my.findParties') }}
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
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle class="font-display text-2xl">{{ t('character.my.add') }}</DialogTitle>
          <DialogDescription>{{ t('character.search.hint') }}</DialogDescription>
        </DialogHeader>
        <CharacterSearch embedded />
      </DialogContent>
    </Dialog>
  </div>
</template>
