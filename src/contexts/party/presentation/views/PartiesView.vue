<script setup lang="ts">
import { PhArrowCounterClockwise, PhMagnifyingGlass, PhWarningCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { Button } from '@/shared/presentation/ui/button'
import { onMounted } from 'vue'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import CreatePartyDialog from '../components/CreatePartyDialog.vue'
import PartySummaryCard from '../components/PartySummaryCard.vue'
import { usePartiesStore } from '../usePartiesStore'

const parties = usePartiesStore()
const active = computed(() => parties.items.filter((i) => !i.party.finishedAt))
/** Mais recentes primeiro. */
const finished = computed(() =>
  parties.items
    .filter((i) => i.party.finishedAt)
    .sort((a, b) => b.party.finishedAt!.getTime() - a.party.finishedAt!.getTime()),
)

// Mostra o que já tem e atualiza em segundo plano (o líder pode ter aceitado/recusado algo).
onMounted(() => void parties.load())

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

    <p v-if="parties.error" role="alert" class="flex items-center gap-2 text-sm text-destructive-ink">
      <PhWarningCircle :size="18" /> {{ parties.error }}
    </p>

    <div v-if="parties.loading && !parties.loaded" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-2xl" />
    </div>

    <p v-else-if="parties.loaded && !parties.items.length" class="text-muted-foreground">
      Você ainda não está em nenhuma party. Crie uma ou peça o link para o líder do seu grupo.
    </p>

    <template v-else>
      <p v-if="!active.length" class="text-muted-foreground">
        Nenhuma party ativa. Crie uma ou peça o link para o líder do seu grupo.
      </p>
      <ul v-else class="space-y-3">
        <li v-for="item in active" :key="item.party.id">
          <PartySummaryCard :item="item" />
        </li>
      </ul>

      <section v-if="finished.length" aria-labelledby="finished-title" class="space-y-3 pt-4">
        <div>
          <h2 id="finished-title" class="font-display text-2xl font-semibold">Finalizadas</h2>
          <p class="text-sm text-muted-foreground">Histórico das raids. Para jogar de novo, crie outra party.</p>
        </div>
        <ul class="space-y-3">
          <li v-for="item in finished" :key="item.party.id" class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1"><PartySummaryCard :item="item" /></div>
            <CreatePartyDialog
              v-if="item.myStatus === 'leader'"
              :prefill="{ name: item.party.name, sanctuaryId: item.party.sanctuary.id, routine: item.party.routine }"
            >
              <Button variant="outline" class="sm:w-auto"><PhArrowCounterClockwise /> Criar de novo</Button>
            </CreatePartyDialog>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
