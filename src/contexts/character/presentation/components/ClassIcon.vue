<script setup lang="ts">
import {
  PhCrosshair,
  PhFire,
  PhGhost,
  PhHandHeart,
  PhKnife,
  PhMusicNotes,
  PhQuestion,
  PhShield,
  PhSword,
} from '@phosphor-icons/vue'
import { computed, type Component } from 'vue'
import {
  normalizeClassName,
  ROLE_LABEL,
  roleOf,
  type CharacterClass,
} from '@/contexts/character/domain/Character'
import { cn } from '@/shared/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/presentation/ui/tooltip'

/*
 * Ícones próprios (Phosphor) por classe. Para usar ícones oficiais no futuro,
 * basta trocar este mapa por <img> apontando para arquivos em /public/classes.
 */
const ICONS: Record<CharacterClass, Component> = {
  Gladiator: PhSword,
  Templar: PhShield,
  Assassin: PhKnife,
  Ranger: PhCrosshair,
  Sorcerer: PhFire,
  Spiritmaster: PhGhost,
  Cleric: PhHandHeart,
  Chanter: PhMusicNotes,
}

const props = withDefaults(defineProps<{ className: string; size?: 'sm' | 'md' }>(), { size: 'md' })

const name = computed(() => normalizeClassName(props.className))
const icon = computed(() => ICONS[name.value as CharacterClass] ?? PhQuestion)
const label = computed(() => {
  const role = roleOf(name.value)
  return role ? `${name.value}, ${ROLE_LABEL[role]}` : name.value
})
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
            'inline-grid flex-none place-items-center rounded-md bg-faction-soft text-faction-ink outline-none focus-visible:ring-2 focus-visible:ring-ring',
            size === 'md' ? 'size-7' : 'size-5 rounded',
          )
        "
      >
        <component :is="icon" :size="size === 'md' ? 18 : 13" weight="duotone" aria-hidden="true" />
      </span>
    </TooltipTrigger>
    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>
