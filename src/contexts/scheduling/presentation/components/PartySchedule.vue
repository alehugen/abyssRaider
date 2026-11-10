<script setup lang="ts">
import { PhTrash, PhWarningCircle } from '@phosphor-icons/vue'
import { computed, ref, shallowRef, watch } from 'vue'
import { getContainer } from '@/app/container'
import type { PartyMember } from '@/contexts/party/domain/Party'
import { Button } from '@/shared/presentation/ui/button'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { myRsvp, rsvpCounts, RSVP_LABEL, type RaidEvent, type RsvpStatus } from '../../domain/RaidEvent'
import { formatRelative, formatTime } from '../format'
import RaidDateBadge from './RaidDateBadge.vue'
import RsvpButtons from './RsvpButtons.vue'
import ScheduleRaidDialog from './ScheduleRaidDialog.vue'

const props = defineProps<{
  partyId: string
  /** Membros aceitos (para mostrar quem confirmou). */
  members: readonly PartyMember[]
  isLeader: boolean
  /** party_members.id do usuário, se for membro aceito. */
  myMemberId: string | null
}>()

const repo = getContainer().raidEventRepository
const events = shallowRef<RaidEvent[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const error = ref<string | null>(null)
const dialog = ref<InstanceType<typeof ScheduleRaidDialog> | null>(null)

async function load() {
  try {
    events.value = await repo.listForParty(props.partyId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
watch(() => props.partyId, load, { immediate: true })

async function run(key: string, action: () => Promise<void>) {
  busy.value = key
  error.value = null
  try {
    await action()
    await load()
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    return false
  } finally {
    busy.value = null
  }
}

async function schedule(dates: Date[], note: string | null) {
  if (await run('schedule', () => repo.schedule(props.partyId, dates, note))) dialog.value?.close()
}

function cancel(event: RaidEvent) {
  if (window.confirm('Cancelar esta raid? As confirmações de presença serão apagadas.')) {
    void run(event.id, () => repo.cancel(event.id))
  }
}

function respond(event: RaidEvent, status: RsvpStatus) {
  if (props.myMemberId) void run(event.id, () => repo.respond(event.id, props.myMemberId!, status))
}

const nameByMember = computed(() => new Map(props.members.map((m) => [m.id, m.linked.character.name])))

function namesWith(event: RaidEvent, status: RsvpStatus): string {
  return event.rsvps
    .filter((r) => r.status === status)
    .map((r) => nameByMember.value.get(r.memberId))
    .filter(Boolean)
    .join(', ')
}

/** Membros aceitos que ainda não responderam. */
function pendingCount(event: RaidEvent): number {
  const answered = new Set(event.rsvps.map((r) => r.memberId))
  return props.members.filter((m) => !answered.has(m.id)).length
}
</script>

<template>
  <section aria-labelledby="schedule-title" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="schedule-title" class="font-display text-2xl font-semibold">Agenda</h2>
      <ScheduleRaidDialog v-if="isLeader" ref="dialog" :busy="busy === 'schedule'" @schedule="schedule" />
    </div>

    <p v-if="error" role="alert" class="flex items-center gap-2 text-sm text-destructive">
      <PhWarningCircle :size="18" /> {{ error }}
    </p>

    <Skeleton v-if="loading" class="h-24 rounded-2xl" />

    <p v-else-if="!events.length" class="text-sm text-muted-foreground">
      {{ isLeader ? 'Nenhuma raid marcada. Agende a próxima para o grupo confirmar presença.' : 'Nenhuma raid marcada ainda.' }}
    </p>

    <ul v-else class="space-y-3">
      <li
        v-for="event in events"
        :key="event.id"
        class="flex flex-wrap items-start gap-4 rounded-2xl border bg-card/60 p-4 sm:flex-nowrap"
      >
        <RaidDateBadge :date="event.startsAt" />

        <div class="min-w-0 flex-1 space-y-1.5">
          <p class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-display text-xl font-semibold tabular-nums">{{ formatTime(event.startsAt) }}</span>
            <span class="text-sm text-muted-foreground">{{ formatRelative(event.startsAt) }}</span>
          </p>
          <p v-if="event.note" class="text-sm">{{ event.note }}</p>
          <p class="flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-muted-foreground">
            <span>
              <b class="font-semibold text-success">{{ rsvpCounts(event).going }}</b> {{ RSVP_LABEL.going.toLowerCase() }}<template
                v-if="namesWith(event, 'going')"
                >: {{ namesWith(event, 'going') }}</template
              >
            </span>
            <span><b class="font-semibold text-warning">{{ rsvpCounts(event).maybe }}</b> talvez</span>
            <span><b class="font-semibold text-destructive">{{ rsvpCounts(event).declined }}</b> não vão</span>
            <span v-if="pendingCount(event)">{{ pendingCount(event) }} sem resposta</span>
          </p>
        </div>

        <div class="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
          <RsvpButtons
            v-if="myMemberId"
            :status="myRsvp(event, myMemberId)"
            :disabled="busy === event.id"
            @respond="respond(event, $event)"
          />
          <Button
            v-if="isLeader"
            size="sm"
            variant="ghost"
            class="text-muted-foreground hover:text-destructive"
            :disabled="busy === event.id"
            @click="cancel(event)"
          >
            <PhTrash /> Cancelar raid
          </Button>
        </div>
      </li>
    </ul>
  </section>
</template>
