<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/contexts/character/domain/Character'
import UiPanel from '@/shared/presentation/ui/UiPanel.vue'
import UiPill from '@/shared/presentation/ui/UiPill.vue'
import CharacterPortrait from './CharacterPortrait.vue'

const props = withDefaults(
  defineProps<{
    character: Character
    /** Rótulo pequeno acima do nome (ex.: "Líder", "Tank", "Seu personagem"). */
    role?: string
    /** Visual apagado: ausente, recusou a raid, etc. */
    inactive?: boolean
    /** md = card completo; sm = linha compacta para listas de party. */
    size?: 'md' | 'sm'
    interactive?: boolean
  }>(),
  { size: 'md', inactive: false, interactive: false },
)

const number = new Intl.NumberFormat('pt-BR')
const combatPower = computed(() =>
  props.character.combatPower != null ? number.format(props.character.combatPower) : null,
)
</script>

<template>
  <UiPanel
    as="article"
    :interactive="interactive"
    class="flex items-center border-t-4 border-faction"
    :class="[`faction-${character.faction}`, size === 'md' ? 'gap-3.5 p-4 sm:gap-4 sm:p-5' : 'gap-3 px-3 py-2.5']"
    :aria-label="`${character.name}, ${character.className} nível ${character.level}`"
  >
    <CharacterPortrait :name="character.name" :src="character.portraitUrl" :size="size" :dimmed="inactive" />

    <div class="flex min-w-0 flex-1 flex-col" :class="size === 'md' ? 'gap-1.5' : 'gap-0.5'">
      <span v-if="role" class="text-xs font-semibold text-faction-ink">{{ role }}</span>

      <h3
        class="truncate font-display leading-tight font-bold text-foreground"
        :class="[size === 'md' ? 'text-2xl sm:text-[28px]' : 'text-lg', inactive && 'text-muted-foreground']"
      >
        {{ character.name }}
      </h3>

      <div v-if="size === 'md'" class="flex flex-wrap gap-1.5">
        <UiPill tone="faction">{{ character.className }}</UiPill>
        <UiPill tone="faction">{{ character.serverName }}</UiPill>
        <UiPill v-if="character.legionName" tone="neutral">{{ character.legionName }}</UiPill>
      </div>

      <p class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
        <span v-if="size === 'sm'" class="font-semibold text-faction-ink">{{ character.className }}</span>
        <span>Nv. <b class="font-semibold text-foreground">{{ character.level }}</b></span>
        <span v-if="combatPower"><b class="font-semibold text-foreground">{{ combatPower }}</b> CP</span>
        <span v-if="character.itemLevel">iLv <b class="font-semibold text-foreground">{{ character.itemLevel }}</b></span>
      </p>
    </div>

    <div v-if="$slots.actions" class="flex flex-none items-center gap-2 self-center">
      <slot name="actions" />
    </div>
  </UiPanel>
</template>
