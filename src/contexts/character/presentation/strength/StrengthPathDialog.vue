<script setup lang="ts">
import { PhArrowClockwise, PhPlusSquare, PhTreeStructure, PhWarningCircle } from '@phosphor-icons/vue'
import { computed, ref, shallowRef, watch } from 'vue'
import { useSanctuariesStore } from '@/contexts/party/presentation/useSanctuariesStore'
import { t } from '@/shared/i18n'
import { numberFormat } from '@/shared/i18n/format'
import { errorMessage } from '@/shared/lib/errorMessage'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/presentation/ui/dialog'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import type { Character } from '../../domain/Character'
import type { CharacterBuild, GearDetail } from '../../domain/CharacterBuild'
import { IMPACT_LABEL, IMPACT_SHORT_LABEL, sanctuaryGoals, strengthPath, type PathStep, type StepKind } from '../../domain/strengthPath'
import { gradeClass, loadBuild, loadGear } from '../inspect/buildCache'

/**
 * Caminho de Fortalecimento: próximos passos para o personagem ficar mais forte,
 * calculados com os dados do jogo. O slot padrão vira o gatilho; nada é buscado
 * antes de abrir.
 */
const props = defineProps<{ character: Character }>()

const open = ref(false)
const build = shallowRef<CharacterBuild | null>(null)
const details = shallowRef<Map<string, GearDetail>>(new Map())
const loading = ref(false)
/** Peças já analisadas / total (o detalhe de cada peça é uma consulta). */
const progress = ref({ done: 0, total: 0 })
const failed = ref(0)
const error = ref<string | null>(null)
const missing = ref(false)

const sanctuaries = useSanctuariesStore()

const ref_ = computed(() => ({
  region: props.character.region,
  serverId: props.character.serverId,
  id: props.character.id,
}))

async function load() {
  loading.value = true
  error.value = null
  failed.value = 0
  try {
    void sanctuaries.load()
    const found = await loadBuild(ref_.value)
    build.value = found
    missing.value = !found
    if (!found) return

    const items = found.equipment
    progress.value = { done: 0, total: items.length }
    const map = new Map<string, GearDetail>()
    // Poucas consultas por vez: a API do jogo não gosta de rajadas.
    const queue = [...items]
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        for (let g = queue.shift(); g; g = queue.shift()) {
          try {
            map.set(g.slotName, await loadGear(ref_.value, g))
          } catch {
            failed.value++
          }
          progress.value = { ...progress.value, done: progress.value.done + 1 }
        }
      }),
    )
    details.value = map
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen && !build.value) void load()
})

const steps = computed(() => (build.value ? strengthPath(build.value, details.value) : []))
const firstSteps = computed(() => steps.value.slice(0, 3))

const SECTIONS: Array<{ id: 'gear' | 'stones' | 'exceed' | 'daevanion'; kinds: StepKind[] }> = [
  { id: 'gear', kinds: ['missing', 'outdated', 'enchant'] },
  { id: 'stones', kinds: ['stones'] },
  { id: 'exceed', kinds: ['exceed'] },
  { id: 'daevanion', kinds: ['daevanion'] },
]
const sections = computed(() =>
  SECTIONS.map((s) => ({
    ...s,
    title: t(`character.strength.sections.${s.id}`),
    steps: steps.value.slice(3).filter((st) => s.kinds.includes(st.kind)),
  })).filter((s) => s.steps.length),
)

const itemLevel = computed(() => build.value?.itemLevel ?? props.character.itemLevel ?? null)
const goals = computed(() => sanctuaryGoals(itemLevel.value, sanctuaries.sanctuaries))
const number = () => numberFormat()

const IMPACT_BARS: Record<PathStep['impact'], number> = { high: 3, medium: 2, low: 1 }
const pct = (p: { current: number; max: number }) => `${Math.min(100, Math.round((p.current / p.max) * 100))}%`
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent
      :class="cn(`faction-${character.faction}`, 'flex max-h-[min(90dvh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl')"
    >
      <DialogHeader class="flex-none px-6 pt-6 pb-4 pr-12 text-left">
        <DialogTitle class="font-display text-3xl leading-none">{{ t('character.strength.title') }}</DialogTitle>
        <DialogDescription class="mt-1">
          {{ t('character.strength.description', { name: character.name }) }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="space-y-4 border-t px-6 py-5" aria-busy="true">
        <p class="text-sm text-muted-foreground tabular-nums">
          {{
            progress.total
              ? t('character.strength.analyzing', { done: progress.done, total: progress.total })
              : t('character.strength.fetching')
          }}
        </p>
        <Skeleton class="h-20 rounded-xl" />
        <div v-for="i in 4" :key="i" class="flex items-center gap-3">
          <Skeleton class="size-11 flex-none rounded-md" />
          <div class="min-w-0 flex-1 space-y-1.5">
            <Skeleton class="h-4" :style="{ width: `${50 + ((i * 29) % 35)}%` }" />
            <Skeleton class="h-3 w-2/3" />
          </div>
        </div>
      </div>

      <div v-else-if="error" role="alert" class="space-y-3 border-t px-6 py-5 text-sm">
        <p class="flex items-center gap-2 text-destructive-ink"><PhWarningCircle :size="18" /> {{ error }}</p>
        <Button size="sm" variant="outline" @click="load"><PhArrowClockwise /> {{ t('common.actions.retry') }}</Button>
      </div>

      <p v-else-if="missing" class="border-t px-6 py-5 text-sm text-muted-foreground">
        {{ t('character.strength.missing') }}
      </p>

      <div v-else-if="build" class="min-h-0 flex-1 space-y-6 overflow-y-auto border-t px-6 py-5">
        <!-- Meta: item level para o próximo santuário -->
        <section :aria-label="t('character.strength.goal')" class="rounded-xl bg-muted/60 p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p class="text-sm text-muted-foreground">
              {{ t('character.card.itemLevel') }}
              <b class="ml-1 font-display text-2xl text-foreground tabular-nums">{{ itemLevel != null ? number().format(itemLevel) : '?' }}</b>
            </p>
            <i18n-t v-if="goals.next" keypath="character.strength.missingFor" tag="p" class="text-sm">
              <template #n><b class="tabular-nums">{{ number().format(goals.next.missing) }}</b></template>
              <template #name>{{ goals.next.name }}</template>
              <template #min>{{ number().format(goals.next.minItemLevel) }}</template>
            </i18n-t>
            <p v-else-if="goals.reached.length" class="text-sm text-success-ink">
              {{ t('character.strength.allReached') }}
            </p>
          </div>
          <div v-if="goals.next && itemLevel" class="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
            <span class="block h-full rounded-full bg-faction" :style="{ width: pct({ current: itemLevel, max: goals.next.minItemLevel }) }" />
          </div>
        </section>

        <p v-if="!steps.length" class="text-sm text-success-ink">
          {{ t('character.strength.nothing') }}
        </p>

        <template v-else>
          <section aria-labelledby="first-steps" class="space-y-2">
            <h3 id="first-steps" class="font-display text-xl font-semibold">{{ t('character.strength.startHere') }}</h3>
            <ol class="space-y-2">
              <li v-for="(s, i) in firstSteps" :key="s.id" class="flex gap-3 rounded-xl border bg-card/60 p-3">
                <span class="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-faction text-xs font-bold text-background">
                  {{ i + 1 }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start gap-3">
                    <div class="min-w-0 flex-1">
                      <p class="font-medium">{{ s.title }}</p>
                      <p class="text-sm text-muted-foreground">{{ s.reason }}</p>
                    </div>
                    <span
                      v-if="s.gear"
                      :class="cn(gradeClass(s.gear.grade), 'grid size-11 flex-none place-items-center overflow-hidden rounded-md border-2 border-(--grade) bg-icon-well')"
                      aria-hidden="true"
                    >
                      <img v-if="s.gear.icon" :src="s.gear.icon" alt="" loading="lazy" class="size-full object-contain" />
                    </span>
                  </div>
                  <div class="mt-2 flex items-center gap-3">
                    <span v-if="s.progress" class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span class="block h-full rounded-full bg-faction" :style="{ width: pct(s.progress) }" />
                    </span>
                    <span v-else class="flex-1" />
                    <span class="flex flex-none items-center gap-1.5 text-xs text-muted-foreground" :title="IMPACT_LABEL[s.impact]">
                      <span class="flex items-end gap-0.5" aria-hidden="true">
                        <span
                          v-for="b in 3"
                          :key="b"
                          :class="cn('w-1 rounded-sm', b <= IMPACT_BARS[s.impact] ? 'bg-faction' : 'bg-muted')"
                          :style="{ height: `${4 + b * 3}px` }"
                        />
                      </span>
                      {{ IMPACT_LABEL[s.impact] }}
                    </span>
                  </div>
                </div>
              </li>
            </ol>
          </section>

          <section v-for="sec in sections" :key="sec.id" :aria-label="sec.title" class="space-y-1">
            <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {{ sec.title }} <span class="tabular-nums">({{ sec.steps.length }})</span>
            </h3>
            <ul class="divide-y divide-border/60">
              <li v-for="s in sec.steps" :key="s.id" class="flex items-center gap-3 py-2">
                <span
                  v-if="s.gear"
                  :class="cn(gradeClass(s.gear.grade), 'grid size-9 flex-none place-items-center overflow-hidden rounded-md border-2 border-(--grade) bg-icon-well')"
                  aria-hidden="true"
                >
                  <img v-if="s.gear.icon" :src="s.gear.icon" alt="" loading="lazy" class="size-full object-contain" />
                </span>
                <span v-else class="grid size-9 flex-none place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                  <PhTreeStructure v-if="s.kind === 'daevanion'" :size="18" />
                  <PhPlusSquare v-else :size="18" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{{ s.title }}</p>
                  <p class="text-xs text-muted-foreground">{{ s.reason }}</p>
                </div>
                <span
                  :class="cn('flex-none text-xs', s.impact === 'high' ? 'font-semibold text-foreground' : 'text-muted-foreground')"
                >
                  {{ IMPACT_SHORT_LABEL[s.impact] }}
                </span>
              </li>
            </ul>
          </section>
        </template>

        <p v-if="failed" class="text-xs text-warning-ink">
          {{ t('character.strength.failed', { n: failed }, failed) }}
          <button type="button" class="underline" @click="load">{{ t('common.actions.retry') }}</button>
        </p>
        <p class="text-xs text-muted-foreground">
          {{ t('character.strength.disclaimer') }}
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
