<script setup lang="ts">
import { PhCaretRight, PhMagnifyingGlass, PhWarningCircle } from '@phosphor-icons/vue'
import { Button } from '@/shared/presentation/ui/button'
import { onMounted } from 'vue'
import { REGION_LABEL } from '@/contexts/character/domain/Character'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import CreatePartyDialog from '../components/CreatePartyDialog.vue'
import type { PartySummary } from '../../domain/Party'
import { usePartiesStore } from '../usePartiesStore'

const parties = usePartiesStore()

onMounted(() => {
  if (!parties.loaded) void parties.load()
})

const STATUS: Record<PartySummary['myStatus'], { label: string; class: string }> = {
  leader: { label: 'Você lidera', class: 'text-primary' },
  accepted: { label: 'Membro', class: 'text-success' },
  pending: { label: 'Pedido enviado', class: 'text-warning' },
  declined: { label: 'Pedido recusado', class: 'text-destructive' },
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-4xl leading-none font-bold">Parties</h1>
        <p class="mt-2 max-w-prose text-muted-foreground">
          Monte o grupo para um santuário ou abra o link que o líder mandou para pedir sua vaga.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" as-child>
          <RouterLink :to="{ name: 'find-parties' }"><PhMagnifyingGlass /> Buscar parties</RouterLink>
        </Button>
        <CreatePartyDialog />
      </div>
    </header>

    <p v-if="parties.error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ parties.error }}
    </p>

    <div v-if="parties.loading && !parties.loaded" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-20 rounded-2xl" />
    </div>

    <p v-else-if="!parties.items.length" class="text-muted-foreground">
      Você ainda não está em nenhuma party. Crie uma ou peça o link para o líder do seu grupo.
    </p>

    <ul v-else class="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card/60">
      <li v-for="item in parties.items" :key="item.party.id">
        <RouterLink
          :to="{ name: 'party', params: { id: item.party.id } }"
          :class="
            cn(
              `faction-${item.party.faction}`,
              'flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none sm:px-5',
            )
          "
        >
          <span class="h-10 w-0.75 flex-none rounded-full bg-faction" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-display text-xl leading-tight font-semibold">{{ item.party.name }}</span>
            <span class="block truncate text-sm text-muted-foreground">
              {{ item.party.sanctuary.name }}, liderada por {{ item.leaderCharacterName }},
              {{ REGION_LABEL[item.party.region] }}
            </span>
          </span>
          <span class="flex-none text-right">
            <span class="block font-display text-xl leading-tight font-semibold tabular-nums">
              {{ item.acceptedCount }}/{{ item.party.sanctuary.groupSize }}
            </span>
            <span :class="cn('block text-xs', STATUS[item.myStatus].class)">{{ STATUS[item.myStatus].label }}</span>
          </span>
          <PhCaretRight class="flex-none text-muted-foreground" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
