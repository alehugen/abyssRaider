<script setup lang="ts">
import { PhCheck, PhCheckCircle } from '@phosphor-icons/vue'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CharacterCard from '@/contexts/character/presentation/components/CharacterCard.vue'
import CharacterSearch from '@/contexts/character/presentation/components/CharacterSearch.vue'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import AvailabilityForm from '@/contexts/scheduling/presentation/components/AvailabilityForm.vue'
import { useAvailabilityStore } from '@/contexts/scheduling/presentation/useAvailabilityStore'
import { TZ_LABEL } from '@/shared/lib/brasilia'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { safeNext } from '../onboarding'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()
const availability = useAvailabilityStore()

onMounted(async () => {
  await Promise.all([characters.loaded ? null : characters.load(), availability.load()])
  // Já estava tudo pronto (ex.: abriu /comecar direto): segue para onde ia.
  if (characters.items.length && availability.windows.length) await finish()
})

const loaded = computed(() => characters.loaded && availability.loaded)
/** 1 = vincular personagem, 2 = disponibilidade. */
const step = computed(() => (characters.items.length ? 2 : 1))

const STEPS = [
  { n: 1, label: 'Vincular personagem' },
  { n: 2, label: 'Disponibilidade' },
] as const

async function finish() {
  await router.replace(safeNext(route.query.next))
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <header class="space-y-2">
      <h1 class="font-display text-4xl leading-tight font-bold">Primeiros passos</h1>
      <p class="max-w-prose text-muted-foreground">
        Dois passos rápidos e você já pode entrar em parties: os líderes veem seu personagem e o AbyssRaider sugere o
        melhor horário para o grupo.
      </p>
    </header>

    <!-- Indicador de etapas -->
    <ol class="flex items-center gap-3" aria-label="Etapas">
      <template v-for="(s, i) in STEPS" :key="s.n">
        <li class="flex items-center gap-2" :aria-current="step === s.n ? 'step' : undefined">
          <span
            :class="
              cn(
                'grid size-8 flex-none place-items-center rounded-full border-2 text-sm font-bold tabular-nums transition-colors',
                step > s.n && 'border-success bg-success text-background',
                step === s.n && 'border-primary bg-primary text-primary-foreground',
                step < s.n && 'border-border text-muted-foreground',
              )
            "
          >
            <PhCheck v-if="step > s.n" weight="bold" aria-hidden="true" />
            <template v-else>{{ s.n }}</template>
          </span>
          <span :class="cn('text-sm font-medium', step < s.n && 'text-muted-foreground')">
            {{ s.label }}<span v-if="step > s.n" class="sr-only"> (concluído)</span>
          </span>
        </li>
        <li v-if="i < STEPS.length - 1" aria-hidden="true" class="h-0.5 min-w-6 flex-1 rounded-full bg-border">
          <span :class="cn('block h-full rounded-full bg-success transition-all', step > 1 ? 'w-full' : 'w-0')" />
        </li>
      </template>
    </ol>

    <div v-if="!loaded" class="space-y-3">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-40 rounded-2xl" />
    </div>

    <template v-else>
      <!-- Passo 1 -->
      <section aria-labelledby="step1-title" class="space-y-3">
        <h2 id="step1-title" class="font-display text-2xl font-semibold">1. Vincule seu personagem</h2>
        <template v-if="step === 1">
          <p class="max-w-prose text-sm text-muted-foreground">
            Busque pelo nome no seu servidor. Classe, CP e item level vêm do site oficial do Aion 2.
          </p>
          <div class="rounded-2xl border bg-card/60 p-4 sm:p-6">
            <CharacterSearch embedded />
          </div>
        </template>
        <div v-else class="space-y-1 rounded-2xl border bg-card/60 px-4 py-2">
          <p class="flex items-center gap-1.5 pt-1 text-sm font-medium text-success">
            <PhCheckCircle aria-hidden="true" /> Vinculado
          </p>
          <CharacterCard v-for="l in characters.items" :key="l.linkId" :character="l.character" size="sm" />
          <p class="pb-1 text-xs text-muted-foreground">Outros personagens dá para vincular depois, em Personagens.</p>
        </div>
      </section>

      <!-- Passo 2 -->
      <section aria-labelledby="step2-title" :class="cn('space-y-3', step < 2 && 'opacity-50')">
        <h2 id="step2-title" class="font-display text-2xl font-semibold">2. Quando você costuma jogar?</h2>
        <p v-if="step < 2" class="text-sm text-muted-foreground">Liberado depois de vincular o personagem.</p>
        <template v-else>
          <p class="max-w-prose text-sm text-muted-foreground">
            Marque os dias e as faixas de horário em que você costuma poder fazer raid, no {{ TZ_LABEL }}. Dá para
            mudar quando quiser, em Personagens.
          </p>
          <div class="rounded-2xl border bg-card/60 p-4 sm:p-6">
            <AvailabilityForm submit-label="Concluir e ir para as parties" @saved="finish" />
          </div>
        </template>
      </section>
    </template>
  </div>
</template>
