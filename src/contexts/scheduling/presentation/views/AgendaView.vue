<script setup lang="ts">
import { errorMessage } from '@/shared/lib/errorMessage'
import { PhArrowClockwise, PhWarningCircle } from '@phosphor-icons/vue'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { getContainer } from '@/app/container'
import { t } from '@/shared/i18n'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { useRefreshOnResume } from '@/shared/presentation/useRefreshOnResume'
import { groupByDay, myRsvp, rsvpCounts, type AgendaEntry, type RsvpStatus } from '../../domain/RaidEvent'
import SanctuaryArt from '@/contexts/party/presentation/components/SanctuaryArt.vue'
import RaidDateBadge from '../components/RaidDateBadge.vue'
import RemindButton from '../components/RemindButton.vue'
import RsvpButtons from '../components/RsvpButtons.vue'
import { formatFullDay, formatRelative, formatTime, tzLabel } from '../format'

const auth = useAuthStore()
const repo = getContainer().raidEventRepository

const entries = shallowRef<AgendaEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)

/** Carregou ao menos uma vez: sem isso, uma falha mostrava "nenhuma raid". */
const loaded = ref(false)
/** Só a consulta mais recente vale (voltar para o app + resposta ao mesmo tempo). */
let seq = 0

async function load() {
  const userId = auth.user?.id
  if (!userId) {
    loading.value = false
    return
  }
  const mine = ++seq
  error.value = null
  try {
    const list = await repo.listAgenda(userId)
    if (mine !== seq || auth.user?.id !== userId) return
    entries.value = list
    loaded.value = true
  } catch (e) {
    if (mine === seq) error.value = errorMessage(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}
onMounted(load)
// Voltou para o app: raids marcadas ou canceladas enquanto estava fora aparecem.
useRefreshOnResume(() => {
  if (!busy.value) void load()
})

const days = computed(() => groupByDay(entries.value, (e) => e.event.startsAt))
const pendingAnswers = computed(() => entries.value.filter((e) => !myRsvp(e.event, e.myMemberId)).length)

async function respond(entry: AgendaEntry, status: RsvpStatus) {
  if (busy.value) return
  busy.value = entry.event.id
  error.value = null
  try {
    await repo.respond(entry.event.id, entry.myMemberId, status)
    await load()
  } catch (e) {
    // Falhou: a raid pode ter sido cancelada ou você saiu da party. Mostra o estado real.
    const message = errorMessage(e)
    await load()
    error.value = message
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="font-display text-4xl leading-tight font-bold">{{ t('scheduling.agenda.title') }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ t('scheduling.agenda.intro', { tz: tzLabel() }) }}
        <i18n-t v-if="pendingAnswers" keypath="scheduling.agenda.pending" tag="span" :plural="pendingAnswers">
          <template #n><b class="font-semibold text-foreground">{{ pendingAnswers }}</b></template>
        </i18n-t>
      </p>
    </header>

    <div v-if="error" role="alert" class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-destructive-ink">
      <span class="flex items-center gap-2"><PhWarningCircle :size="18" /> {{ error }}</span>
      <Button size="sm" variant="outline" data-action="retry" @click="load()">
        <PhArrowClockwise /> {{ t('common.actions.retry') }}
      </Button>
    </div>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-2xl" />
    </div>

    <template v-else-if="!loaded" />

    <div v-else-if="!entries.length" class="space-y-3 rounded-2xl border border-dashed p-6 text-center">
      <p class="font-medium">{{ t('scheduling.agenda.empty') }}</p>
      <p class="text-sm text-muted-foreground">{{ t('scheduling.agenda.emptyHint') }}</p>
      <Button variant="outline" as-child>
        <RouterLink :to="{ name: 'find-parties' }">{{ t('scheduling.agenda.findParties') }}</RouterLink>
      </Button>
    </div>

    <template v-else>
    <section v-for="day in days" :key="day.key" class="space-y-3">
      <h2 class="flex items-center gap-3 font-display text-xl font-semibold first-letter:uppercase">
        {{ formatFullDay(day.day) }}
      </h2>
      <ul class="space-y-3">
        <li
          v-for="entry in day.items"
          :key="entry.event.id"
          :class="
            cn(
              `faction-${entry.faction}`,
              'group relative isolate flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border bg-card/60 p-4 sm:flex-nowrap',
            )
          "
        >
          <SanctuaryArt :src="entry.sanctuaryImageUrl" />
          <RaidDateBadge :date="entry.event.startsAt" />
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-display text-xl font-semibold tabular-nums">{{ formatTime(entry.event.startsAt) }}</span>
              <span class="text-xs text-muted-foreground">{{ tzLabel() }}</span>
              <RouterLink
                :to="{ name: 'party', params: { id: entry.event.partyId } }"
                class="truncate font-semibold hover:underline"
              >
                {{ entry.partyName }}
              </RouterLink>
              <span class="text-sm text-muted-foreground">{{ formatRelative(entry.event.startsAt) }}</span>
            </p>
            <i18n-t
              keypath="scheduling.agenda.entryDetail"
              tag="p"
              class="text-sm text-muted-foreground"
              :plural="rsvpCounts(entry.event).going"
            >
              <template #sanctuary>{{ entry.sanctuaryName }}</template>
              <template #character><span class="text-faction-ink">{{ entry.myCharacterName }}</span></template>
              <template #going>{{ rsvpCounts(entry.event).going }}</template>
            </i18n-t>
            <p v-if="entry.event.note" class="mt-1 text-sm">{{ entry.event.note }}</p>
          </div>
          <div class="flex w-full flex-col items-end gap-1 sm:w-auto">
            <RsvpButtons
              :status="myRsvp(entry.event, entry.myMemberId)"
              :disabled="busy === entry.event.id"
              @respond="respond(entry, $event)"
            />
            <RemindButton
              v-if="entry.isLeader && entry.event.startsAt.getTime() > Date.now()"
              :event-id="entry.event.id"
              :party-name="entry.partyName"
            />
          </div>
        </li>
      </ul>
    </section>
    </template>
  </div>
</template>
