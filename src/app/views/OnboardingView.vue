<script setup lang="ts">
import { PhCheck, PhCheckCircle, PhWarningCircle } from '@phosphor-icons/vue'
import { Button } from '@/shared/presentation/ui/button'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CharacterCard from '@/contexts/character/presentation/components/CharacterCard.vue'
import CharacterSearch from '@/contexts/character/presentation/components/CharacterSearch.vue'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import AvailabilityForm from '@/contexts/scheduling/presentation/components/AvailabilityForm.vue'
import { useAvailabilityStore } from '@/contexts/scheduling/presentation/useAvailabilityStore'
import { t } from '@/shared/i18n'
import { tzLabel } from '@/shared/lib/brasilia'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { safeNext } from '../onboarding'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()
const availability = useAvailabilityStore()

async function loadAll() {
  await Promise.all([characters.loaded ? null : characters.load(), availability.load()])
  // Já estava tudo pronto (ex.: abriu /comecar direto): segue para onde ia.
  if (characters.items.length && availability.windows.length) await finish()
}
onMounted(loadAll)

const loaded = computed(() => characters.loaded && availability.loaded)
/** Falhou ao carregar: mostra o erro e deixa tentar de novo (antes ficava no skeleton). */
const loadError = computed(() => (loaded.value ? null : (characters.error ?? availability.error)))
/** 1 = vincular personagem, 2 = disponibilidade. */
const step = computed(() => (characters.items.length ? 2 : 1))

/** `label` é a chave em app.onboarding.steps.* (traduzida no render). */
const STEPS = [
  { n: 1, label: 'character' },
  { n: 2, label: 'availability' },
] as const

async function finish() {
  await router.replace(safeNext(route.query.next))
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <header class="space-y-2">
      <h1 class="font-display text-4xl leading-tight font-bold">{{ t('app.onboarding.title') }}</h1>
      <p class="max-w-prose text-muted-foreground">{{ t('app.onboarding.intro') }}</p>
    </header>

    <!-- Indicador de etapas -->
    <ol class="flex items-center gap-3" :aria-label="t('app.onboarding.stepsLabel')">
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
            {{ t(`app.onboarding.steps.${s.label}`) }}<span v-if="step > s.n" class="sr-only"> ({{ t('app.onboarding.done') }})</span>
          </span>
        </li>
        <li v-if="i < STEPS.length - 1" aria-hidden="true" class="h-0.5 min-w-6 flex-1 rounded-full bg-border">
          <span :class="cn('block h-full rounded-full bg-success transition-[width] duration-500', step > 1 ? 'w-full' : 'w-0')" />
        </li>
      </template>
    </ol>

    <div v-if="loadError" role="alert" class="space-y-3">
      <p class="flex items-center gap-2 text-sm text-destructive-ink">
        <PhWarningCircle :size="18" aria-hidden="true" /> {{ loadError }}
      </p>
      <Button variant="outline" size="sm" @click="loadAll">{{ t('common.actions.retry') }}</Button>
    </div>

    <div v-else-if="!loaded" class="space-y-3">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-40 rounded-2xl" />
    </div>

    <template v-else>
      <!-- Passo 1 -->
      <section aria-labelledby="step1-title" class="space-y-3">
        <h2 id="step1-title" class="font-display text-2xl font-semibold">{{ t('app.onboarding.step1.title') }}</h2>
        <template v-if="step === 1">
          <p class="max-w-prose text-sm text-muted-foreground">{{ t('app.onboarding.step1.hint') }}</p>
          <div class="rounded-2xl border bg-card/60 p-4 sm:p-6">
            <CharacterSearch embedded />
          </div>
        </template>
        <div v-else class="space-y-1 rounded-2xl border bg-card/60 px-4 py-2">
          <p class="flex items-center gap-1.5 pt-1 text-sm font-medium text-success-ink">
            <PhCheckCircle aria-hidden="true" /> {{ t('app.onboarding.step1.linked') }}
          </p>
          <CharacterCard v-for="l in characters.items" :key="l.linkId" :character="l.character" size="sm" />
          <p class="pb-1 text-xs text-muted-foreground">{{ t('app.onboarding.step1.more') }}</p>
        </div>
      </section>

      <!-- Passo 2 -->
      <section aria-labelledby="step2-title" :class="cn('space-y-3 transition-opacity duration-300', step < 2 && 'opacity-50')">
        <h2 id="step2-title" class="font-display text-2xl font-semibold">{{ t('app.onboarding.step2.title') }}</h2>
        <p v-if="step < 2" class="text-sm text-muted-foreground">{{ t('app.onboarding.step2.locked') }}</p>
        <template v-else>
          <p class="max-w-prose text-sm text-muted-foreground">
            {{ t('app.onboarding.step2.hint', { tz: tzLabel() }) }}
          </p>
          <div class="rounded-2xl border bg-card/60 p-4 sm:p-6">
            <AvailabilityForm :submit-label="t('app.onboarding.step2.submit')" @saved="finish" />
          </div>
        </template>
      </section>
    </template>
  </div>
</template>
