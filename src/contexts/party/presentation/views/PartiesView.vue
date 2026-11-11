<script setup lang="ts">
import { PhMagnifyingGlass, PhWarningCircle } from '@phosphor-icons/vue'
import { Button } from '@/shared/presentation/ui/button'
import { onMounted } from 'vue'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import CreatePartyDialog from '../components/CreatePartyDialog.vue'
import PartySummaryCard from '../components/PartySummaryCard.vue'
import { usePartiesStore } from '../usePartiesStore'

const parties = usePartiesStore()

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

    <p v-if="parties.error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ parties.error }}
    </p>

    <div v-if="parties.loading && !parties.loaded" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-20 rounded-2xl" />
    </div>

    <p v-else-if="parties.loaded && !parties.items.length" class="text-muted-foreground">
      Você ainda não está em nenhuma party. Crie uma ou peça o link para o líder do seu grupo.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="item in parties.items" :key="item.party.id">
        <PartySummaryCard :item="item" />
      </li>
    </ul>
  </div>
</template>
