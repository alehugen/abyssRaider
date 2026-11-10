<script setup lang="ts">
import { computed } from 'vue'
import type { Character, CharacterSummary } from '@/contexts/character/domain/Character'
import { cn } from '@/shared/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/presentation/ui/avatar'
import { Badge } from '@/shared/presentation/ui/badge'
import { Card } from '@/shared/presentation/ui/card'

/** Aceita o personagem completo ou só o resumo da busca (sem classe/CP). */
type CardCharacter = CharacterSummary & Partial<Pick<Character, 'className' | 'combatPower' | 'itemLevel' | 'legionName'>>

const props = withDefaults(
  defineProps<{
    character: CardCharacter
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
const initials = computed(() => props.character.name.slice(0, 2).toUpperCase())
const md = computed(() => props.size === 'md')
</script>

<template>
  <Card
    role="article"
    :class="
      cn(
        `faction-${character.faction}`,
        'flex-row items-center border-t-4 border-faction',
        md ? 'gap-3.5 p-4 sm:gap-4 sm:p-5' : 'gap-3 px-3 py-2.5',
        interactive && 'transition-[box-shadow,translate] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover',
      )
    "
    :aria-label="[character.name, character.className, `nível ${character.level}`, character.serverName].filter(Boolean).join(', ')"
  >
    <Avatar
      :class="
        cn(
          'bg-faction-soft',
          md ? 'size-18 rounded-[22px] sm:size-22 sm:rounded-[28px]' : 'size-12 rounded-2xl',
          inactive && 'opacity-85 grayscale-[.85]',
        )
      "
    >
      <AvatarImage v-if="character.portraitUrl" :src="character.portraitUrl" :alt="`Retrato de ${character.name}`" class="object-cover" />
      <AvatarFallback
        :class="cn('rounded-none bg-transparent font-display font-bold text-faction-ink', md ? 'text-2xl' : 'text-base')"
      >
        {{ initials }}
      </AvatarFallback>
    </Avatar>

    <div class="flex min-w-0 flex-1 flex-col" :class="md ? 'gap-1.5' : 'gap-0.5'">
      <span v-if="role" class="text-xs font-semibold text-faction-ink">{{ role }}</span>

      <h3
        :class="
          cn(
            'truncate font-display leading-tight font-bold',
            md ? 'text-2xl sm:text-[28px]' : 'text-lg',
            inactive && 'text-muted-foreground',
          )
        "
      >
        {{ character.name }}
      </h3>

      <div v-if="md" class="flex flex-wrap gap-1.5">
        <Badge v-if="character.className" variant="faction">{{ character.className }}</Badge>
        <Badge variant="faction">{{ character.serverName }}</Badge>
        <Badge v-if="character.legionName" variant="secondary" class="px-2.5 text-[13px] font-semibold">
          {{ character.legionName }}
        </Badge>
      </div>

      <p class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
        <span v-if="!md && character.className" class="font-semibold text-faction-ink">{{ character.className }}</span>
        <span v-if="!md">{{ character.serverName }}</span>
        <span>Nv. <b class="font-semibold text-foreground">{{ character.level }}</b></span>
        <span v-if="combatPower"><b class="font-semibold text-foreground">{{ combatPower }}</b> CP</span>
        <span v-if="character.itemLevel">iLv <b class="font-semibold text-foreground">{{ character.itemLevel }}</b></span>
      </p>
    </div>

    <div v-if="$slots.actions" class="flex flex-none items-center gap-2">
      <slot name="actions" />
    </div>
  </Card>
</template>
