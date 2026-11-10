<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { normalizeClassName, rolesLabel } from '@/contexts/character/domain/Character'
import { cn } from '@/shared/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/presentation/ui/tooltip'

/*
 * Brasões oficiais das classes, servidos pelo CDN da NCSOFT (os mesmos do site do jogo).
 * O CDN usa os nomes internos: Spiritmaster = elementalist, Brawler = fighter.
 */
const CDN = 'https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_'
const FILE: Record<string, string> = { Spiritmaster: 'elementalist', Brawler: 'fighter' }

const props = withDefaults(defineProps<{ className: string; size?: 'sm' | 'md' }>(), { size: 'md' })

const name = computed(() => normalizeClassName(props.className))
const src = computed(() => `${CDN}${FILE[name.value] ?? name.value.toLowerCase()}.png`)
const label = computed(() => {
  const roles = rolesLabel(name.value)
  return roles ? `${name.value}, ${roles}` : name.value
})

const failed = ref(false)
watch(src, () => (failed.value = false))
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span
        role="img"
        tabindex="0"
        :aria-label="label"
        :class="
          cn(
            'relative inline-grid flex-none place-items-center overflow-hidden rounded-lg bg-[oklch(0.2_0.03_260)] ring-1 ring-faction/40 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            size === 'md' ? 'size-8' : 'size-6 rounded-md',
          )
        "
      >
        <img
          v-if="!failed"
          :src="src"
          alt=""
          loading="lazy"
          draggable="false"
          class="size-[85%] object-contain drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]"
          @error="failed = true"
        />
        <span v-else class="text-[10px] font-bold text-white/80">{{ name.slice(0, 2).toUpperCase() }}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>
