<script setup lang="ts">
import { PhClock, PhPencilSimple } from '@phosphor-icons/vue'
import { TZ_LABEL } from '@/shared/lib/brasilia'
import { Button } from '@/shared/presentation/ui/button'
import { formatRow } from '../../domain/Availability'
import { useAvailabilityStore } from '../useAvailabilityStore'
import AvailabilityDialog from './AvailabilityDialog.vue'

const store = useAvailabilityStore()
void store.load()
</script>

<template>
  <section aria-labelledby="availability-title" class="rounded-2xl border bg-card/60 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="availability-title" class="flex items-center gap-2 font-display text-xl font-semibold">
          <PhClock class="text-muted-foreground" aria-hidden="true" /> Sua disponibilidade
        </h2>
        <p v-if="!store.loaded" class="mt-1 text-sm text-muted-foreground">Carregando…</p>
        <p v-else-if="!store.rows.length" class="mt-1 max-w-prose text-sm text-muted-foreground">
          Diga quando você pode jogar. Com isso sugerimos o melhor horário para a party e mostramos as parties que
          batem com a sua agenda.
        </p>
        <ul v-else class="mt-1 space-y-0.5 text-sm">
          <li v-for="(row, i) in store.rows" :key="i" class="first-letter:uppercase">{{ formatRow(row) }}</li>
          <li class="text-xs text-muted-foreground">{{ TZ_LABEL }}</li>
        </ul>
        <p v-if="store.error" role="alert" class="mt-1 text-sm text-destructive">{{ store.error }}</p>
      </div>
      <AvailabilityDialog>
        <Button :variant="store.rows.length ? 'ghost' : 'default'" size="sm" :disabled="!store.loaded">
          <PhPencilSimple /> {{ store.rows.length ? 'Editar' : 'Informar disponibilidade' }}
        </Button>
      </AvailabilityDialog>
    </div>
  </section>
</template>
