<script setup lang="ts">
import { PhCaretRight, PhCrown } from '@phosphor-icons/vue'
import { REGION_LABEL } from '@/contexts/character/domain/Character'
import ClassIcon from '@/contexts/character/presentation/components/ClassIcon.vue'
import { cn } from '@/shared/lib/utils'
import type { PartySummary } from '../../domain/Party'
import { formatRoutine } from '../routineFormat'

/** Card da lista "Minhas parties": arte do santuário ao fundo e o líder em destaque. */
defineProps<{ item: PartySummary }>()

const STATUS: Record<PartySummary['myStatus'], { label: string; class: string }> = {
  leader: { label: 'Você lidera', class: 'text-primary' },
  accepted: { label: 'Membro', class: 'text-success' },
  pending: { label: 'Pedido enviado', class: 'text-warning' },
  declined: { label: 'Pedido recusado', class: 'text-destructive' },
}
</script>

<template>
  <RouterLink
    :to="{ name: 'party', params: { id: item.party.id } }"
    :class="
      cn(
        `faction-${item.party.faction}`,
        'group relative isolate flex items-center gap-4 overflow-hidden rounded-2xl border bg-card px-4 py-4 shadow-card transition-[box-shadow,border-color] hover:border-faction/60 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-5',
      )
    "
  >
    <!-- Arte do santuário à direita, esmaecendo para o fundo do card. -->
    <img
      v-if="item.party.sanctuary.imageUrl"
      :src="item.party.sanctuary.imageUrl"
      alt=""
      loading="lazy"
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-3/5 object-cover object-[center_25%] opacity-45 mask-l-from-35% mask-l-to-100% transition-[opacity,transform] duration-500 group-hover:scale-105 group-hover:opacity-60 dark:opacity-55"
    />

    <span class="h-12 w-0.75 flex-none rounded-full bg-faction" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="block truncate font-display text-xl leading-tight font-semibold">{{ item.party.name }}</span>
      <span class="mt-1 flex min-w-0 items-center gap-1.5 text-sm">
        <PhCrown weight="fill" class="flex-none text-primary" aria-hidden="true" />
        <span class="sr-only">Líder:</span>
        <ClassIcon v-if="item.leaderClassName" :class-name="item.leaderClassName" size="sm" />
        <span class="truncate font-semibold text-faction-ink">{{ item.leaderCharacterName }}</span>
      </span>
      <span class="mt-0.5 block truncate text-[13px] text-muted-foreground">
        {{ item.party.sanctuary.name }} · {{ REGION_LABEL[item.party.region] }}
        <template v-if="item.party.routine">
          · <span class="first-letter:uppercase">{{ formatRoutine(item.party.routine) }}</span>
        </template>
      </span>
    </span>
    <span class="flex-none rounded-xl bg-card/85 px-3 py-1.5 text-right shadow-sm backdrop-blur-sm">
      <span class="block font-display text-xl leading-tight font-semibold tabular-nums">
        {{ item.acceptedCount }}/{{ item.party.sanctuary.groupSize }}
      </span>
      <span :class="cn('block text-xs font-medium', STATUS[item.myStatus].class)">{{ STATUS[item.myStatus].label }}</span>
    </span>
    <PhCaretRight class="flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
  </RouterLink>
</template>
