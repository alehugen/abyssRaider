<script setup lang="ts">
import { PhArrowClockwise, PhArrowCounterClockwise, PhMagnifyingGlass, PhWarningCircle } from '@phosphor-icons/vue'
import { computed, onMounted } from 'vue'
import { t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { useRefreshOnResume } from '@/shared/presentation/useRefreshOnResume'
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
useRefreshOnResume(() => void parties.load())
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-4xl leading-none font-bold">{{ t('party.list.title') }}</h1>
        <p class="mt-2 max-w-prose text-muted-foreground">
          {{ t('party.list.intro') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" as-child>
          <RouterLink :to="{ name: 'find-parties' }"><PhMagnifyingGlass /> {{ t('party.list.find') }}</RouterLink>
        </Button>
        <CreatePartyDialog />
      </div>
    </header>

    <div v-if="parties.error" role="alert" class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-destructive-ink">
      <span class="flex items-center gap-2"><PhWarningCircle :size="18" /> {{ parties.error }}</span>
      <Button size="sm" variant="outline" data-action="retry" :disabled="parties.loading" @click="parties.load()">
        <PhArrowClockwise /> {{ t('common.actions.retry') }}
      </Button>
    </div>

    <!-- Sem nada carregado ainda: esqueleto (ou só o erro acima, sem dizer que a lista está vazia). -->
    <div v-if="!parties.hasData" class="space-y-3">
      <template v-if="parties.loading || !parties.error">
        <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-2xl" />
      </template>
    </div>

    <p v-else-if="!parties.items.length" class="text-muted-foreground">
      {{ t('party.list.empty') }}
    </p>

    <template v-else>
      <p v-if="!active.length" class="text-muted-foreground">
        {{ t('party.list.noActive') }}
      </p>
      <ul v-else class="space-y-3">
        <li v-for="item in active" :key="item.party.id">
          <PartySummaryCard :item="item" />
        </li>
      </ul>

      <section v-if="finished.length" aria-labelledby="finished-title" class="space-y-3 pt-4">
        <div>
          <h2 id="finished-title" class="font-display text-2xl font-semibold">{{ t('party.list.finishedTitle') }}</h2>
          <p class="text-sm text-muted-foreground">{{ t('party.list.finishedHint') }}</p>
        </div>
        <ul class="space-y-3">
          <li v-for="item in finished" :key="item.party.id" class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1"><PartySummaryCard :item="item" /></div>
            <CreatePartyDialog
              v-if="item.myStatus === 'leader'"
              :prefill="{ name: item.party.name, sanctuaryId: item.party.sanctuary.id, routine: item.party.routine }"
            >
              <Button variant="outline" class="sm:w-auto"><PhArrowCounterClockwise /> {{ t('party.list.createAgain') }}</Button>
            </CreatePartyDialog>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
