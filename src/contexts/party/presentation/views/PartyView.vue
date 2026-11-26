<script setup lang="ts">
import {
  PhArrowLeft,
  PhCalendarDots,
  PhCheck,
  PhCircleNotch,
  PhArrowCounterClockwise,
  PhDiscordLogo,
  PhFlagCheckered,
  PhDotsSixVertical,
  PhEnvelopeOpen,
  PhUserPlus,
  PhEye,
  PhLink,
  PhPencilSimple,
  PhSignOut,
  PhTrash,
  PhWarningCircle,
  PhX,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { REGION_LABEL, ROLE_LABEL } from '@/contexts/character/domain/Character'
import CharacterCard from '@/contexts/character/presentation/components/CharacterCard.vue'
import InspectCharacter from '@/contexts/character/presentation/inspect/InspectCharacter.vue'
import PartySchedule from '@/contexts/scheduling/presentation/components/PartySchedule.vue'
import PartyBestTime from '@/contexts/scheduling/presentation/components/PartyBestTime.vue'
import { usePartyAvailability } from '@/contexts/scheduling/presentation/usePartyAvailability'
import { formatDuration, nextSlotStart } from '@/contexts/scheduling/domain/Availability'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { t } from '@/shared/i18n'
import { cn } from '@/shared/lib/utils'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
import { Button } from '@/shared/presentation/ui/button'
import { Input } from '@/shared/presentation/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import {
  assignRoles,
  canJoin,
  composition,
  joinBlockedMessage,
  canRequestJoin,
  GROUP_SIZE,
  groups,
  moveInLayout,
  ROLE_ORDER,
  type PartyMember,
} from '../../domain/Party'
import { useSlotDrag } from '../useSlotDrag'
import { usePartyDetail } from '../usePartyDetail'
import PartyNotificationsDialog from '../components/PartyNotificationsDialog.vue'
import CreatePartyDialog from '../components/CreatePartyDialog.vue'
import AnnounceDiscordButton from '../components/AnnounceDiscordButton.vue'
import { formatFullDay } from '@/contexts/scheduling/presentation/format'
import { nextOccurrences } from '../../domain/RaidRoutine'
import { formatRoutine } from '../routineFormat'

const route = useRoute()
const router = useRouter()
const partyId = computed(() => String(route.params.id))

const p = usePartyDetail(partyId)
const characters = useCharactersStore()

watch(partyId, () => void p.load(), { immediate: true })
if (!characters.loaded) void characters.load()

const party = computed(() => p.details.value?.party ?? null)
// --- renomear (líder): o título vira um campo de texto.
const editingName = ref(false)
const draftName = ref('')
const nameValid = computed(() => {
  const n = draftName.value.trim()
  return n.length >= 2 && n.length <= 40
})
function startRename() {
  draftName.value = party.value?.name ?? ''
  editingName.value = true
}
async function saveName() {
  if (!nameValid.value) return
  if (draftName.value.trim() === party.value?.name) {
    editingName.value = false
    return
  }
  if (await p.rename(draftName.value)) editingName.value = false
}

const nextRoutineDate = computed(() => (party.value?.routine ? (nextOccurrences(party.value.routine, 1)[0] ?? null) : null))
// --- formação: arrastar e soltar (líder). Aplica na tela na hora e grava em seguida.
const optimistic = ref<Map<string, number> | null>(null)
const roster = computed(() => {
  if (!party.value) return []
  const layout = optimistic.value
  const members = layout ? p.accepted.value.map((m) => ({ ...m, slot: layout.get(m.id) ?? null })) : p.accepted.value
  return groups(party.value, members)
})

async function moveMember(from: number, to: number) {
  if (p.busy.value) return // um salvamento por vez: senão a formação "pula" entre estados
  const layout = moveInLayout(roster.value, from, to)
  optimistic.value = new Map(layout.map((x) => [x.memberId, x.slot]))
  await p.setLayout(layout) // recarrega a party; se falhar, o erro aparece e a tela volta
  optimistic.value = null
}

const {
  from: dragFrom,
  over: dragOver,
  pointer: dragPointer,
  mode: dragMode,
  onPointerDown,
  onKeyDown,
} = useSlotDrag({ total: () => roster.value.length * GROUP_SIZE, onDrop: (a, b) => void moveMember(a, b) })

const dragged = computed(() => (dragFrom.value != null ? (roster.value.flat()[dragFrom.value] ?? null) : null))
const slotName = (i: number) => t('party.view.slotName', { group: Math.floor(i / GROUP_SIZE) + 1, slot: (i % GROUP_SIZE) + 1 })
/** Anúncio para leitor de tela no modo teclado. */
const dragStatus = computed(() =>
  dragMode.value === 'keyboard' && dragged.value && dragOver.value != null
    ? t('party.view.dragStatus', { name: dragged.value.linked.character.name, slot: slotName(dragOver.value) })
    : '',
)
const comp = computed(() => composition(p.accepted.value, party.value?.sanctuary.groupSize ?? 10))
const assigned = computed(() => assignRoles(p.accepted.value, party.value?.sanctuary.groupSize ?? 10))
// Disponibilidade dos membros: melhor horário e sugestões ao agendar a raid da semana.
const availability = usePartyAvailability(() => p.accepted.value)
const scheduleOptions = computed(() =>
  availability.bestPerDay.value
    .map((s) => ({
      date: nextSlotStart(s),
      detail: t('party.view.freeOf', {
        free: s.people.length,
        total: p.accepted.value.length,
        duration: formatDuration(s.end - s.start),
      }),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime()),
)

const full = computed(() => !!party.value && p.accepted.value.length >= party.value.sanctuary.groupSize)

function roleLabel(m: PartyMember): string {
  if (party.value && m.linked.linkId === party.value.leaderCharacterLinkId) return t('party.view.leader')
  const role = assigned.value.get(m.id)
  const label = role ? ROLE_LABEL[role] : ''
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// --- entrar na party
const joinOptions = computed(() =>
  party.value
    ? characters.items.map((linked) => {
        const check = canJoin(party.value!, linked)
        return { linked, ok: check.ok, reason: check.ok ? null : check.reason }
      })
    : [],
)
/** Nenhum personagem pode entrar: explica (antes só ficava tudo desativado). */
const joinBlocked = computed(() => (party.value ? joinBlockedMessage(party.value, characters.items) : null))
/** Quem foi recusado pode pedir de novo (antes só via 'Encontrar parties'). */
const canRequest = computed(() => canRequestJoin(p.myMembership.value?.status))
const joinCharacter = ref('')
watch(joinOptions, (opts) => {
  if (!opts.some((o) => o.linked.linkId === joinCharacter.value && o.ok)) {
    joinCharacter.value = opts.find((o) => o.ok)?.linked.linkId ?? ''
  }
})

// --- link de convite
const copied = ref(false)
async function copyLink() {
  const url = new URL(router.resolve({ name: 'party', params: { id: partyId.value } }).href, window.location.origin)
  try {
    await navigator.clipboard.writeText(url.toString())
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    window.prompt(t('party.view.copyPrompt'), url.toString())
  }
}

async function deleteParty() {
  if (!party.value) return
  const ok = await confirm({
    title: t('party.view.deleteTitle', { name: party.value.name }),
    description: t('party.view.deleteDescription'),
    confirmText: t('party.view.deleteConfirm'),
    destructive: true,
  })
  if (!ok) return
  if (await p.removeParty()) await router.push({ name: 'parties' })
}

const finishedLabel = computed(() => (party.value?.finishedAt ? formatFullDay(party.value.finishedAt) : ''))

async function finishParty() {
  if (!party.value) return
  const ok = await confirm({
    title: t('party.view.finishTitle', { name: party.value.name }),
    description: t('party.view.finishDescription'),
    confirmText: t('party.view.finishConfirm'),
  })
  if (ok) await p.finishParty()
}

async function leave() {
  const m = p.myMembership.value
  if (!m) return
  const pending = m.status === 'pending'
  const invited = m.status === 'invited'
  const ok = await confirm({
    title: invited ? t('party.view.leave.declineTitle') : pending ? t('party.view.leave.cancelTitle') : t('party.view.leave.leaveTitle'),
    description: pending || invited ? undefined : t('party.view.leave.leaveDescription'),
    confirmText: invited ? t('party.view.leave.decline') : pending ? t('party.view.leave.cancel') : t('party.view.leave.leave'),
    cancelText: t('common.actions.back'),
    destructive: !pending,
  })
  if (ok) await p.removeMember(m.id)
}

async function removeMember(m: PartyMember) {
  const ok = await confirm({
    title: t('party.view.removeTitle', { name: m.linked.character.name }),
    description: t('party.view.removeDescription', { owner: m.ownerName }),
    confirmText: t('party.view.remove'),
    destructive: true,
  })
  if (ok) void p.removeMember(m.id)
}
</script>

<template>
  <div class="space-y-8">
    <RouterLink
      :to="{ name: 'parties' }"
      class="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
    >
      <PhArrowLeft /> {{ t('party.list.title') }}
    </RouterLink>

    <div v-if="p.loading.value" class="space-y-4">
      <Skeleton class="h-10 w-64" />
      <Skeleton class="h-64 rounded-2xl" />
    </div>

    <p v-else-if="p.notFound.value" class="text-muted-foreground">
      {{ t('party.view.notFound') }}
    </p>

    <!-- Falhou ao carregar (rede, sessão): antes a tela ficava em branco. -->
    <div v-else-if="!party && p.error.value" role="alert" class="space-y-3">
      <p class="flex items-center gap-2 text-sm text-destructive-ink">
        <PhWarningCircle :size="18" aria-hidden="true" /> {{ p.error.value }}
      </p>
      <Button variant="outline" size="sm" @click="p.load()">{{ t('common.actions.retry') }}</Button>
    </div>

    <template v-else-if="party">
      <!-- Arte do santuário no fundo do topo da página, esmaecendo para o fundo do tema. -->
      <div
        v-if="party.sanctuary.imageUrl"
        class="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[75vh] overflow-hidden"
        aria-hidden="true"
      >
        <img
          :src="party.sanctuary.imageUrl"
          alt=""
          class="size-full scale-105 object-cover object-[center_20%] opacity-0 blur-[2px] transition-opacity duration-700 mask-b-from-20% mask-b-to-100% data-loaded:opacity-60"
          @load="($event.target as HTMLImageElement).dataset.loaded = ''"
        />
        <div class="absolute inset-0 bg-linear-to-r from-background via-background/50 to-background/10" />
      </div>

      <header :class="cn(`faction-${party.faction}`, 'flex flex-wrap items-end justify-between gap-4')">
        <div class="min-w-0">
          <form v-if="editingName" class="flex flex-wrap items-center gap-2" @submit.prevent="saveName">
            <label for="party-name" class="sr-only">{{ t('party.view.nameLabel') }}</label>
            <Input
              id="party-name"
              v-model="draftName"
              maxlength="40"
              autocomplete="off"
              autofocus
              class="h-11 w-72 max-w-full font-display text-2xl font-bold"
              @keydown.esc="editingName = false"
            />
            <Button type="submit" size="sm" :disabled="!nameValid || !!p.busy.value">
              <PhCheck /> {{ t('common.actions.save') }}
            </Button>
            <Button type="button" size="sm" variant="ghost" @click="editingName = false">{{ t('common.actions.cancel') }}</Button>
          </form>
          <div v-else class="flex items-center gap-1">
            <h1 class="font-display text-4xl leading-none font-bold break-words">{{ party.name }}</h1>
            <Button
              v-if="p.canManage.value"
              size="icon"
              variant="ghost"
              class="size-8 flex-none text-muted-foreground"
              :aria-label="t('party.view.rename')"
              :title="t('party.view.rename')"
              @click="startRename"
            >
              <PhPencilSimple />
            </Button>
          </div>
          <p class="mt-2 text-muted-foreground">
            {{ t('party.view.subtitle', { sanctuary: party.sanctuary.name, region: REGION_LABEL[party.region] }) }}
          </p>
          <p v-if="party.routine" class="mt-1 flex items-center gap-1.5 text-sm">
            <PhCalendarDots class="text-muted-foreground" aria-hidden="true" />
            <span class="first-letter:uppercase">{{ formatRoutine(party.routine) }}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" @click="copyLink">
            <PhCheck v-if="copied" />
            <PhLink v-else />
            {{ copied ? t('party.view.linkCopied') : t('party.view.copyLink') }}
          </Button>
          <Button v-if="p.canManage.value" variant="outline" :disabled="!!p.busy.value" @click="finishParty">
            <PhFlagCheckered /> {{ t('party.view.finish') }}
          </Button>
          <CreatePartyDialog
            v-if="p.isLeader.value && p.finished.value"
            :prefill="{ name: party.name, sanctuaryId: party.sanctuary.id, routine: party.routine }"
          >
            <Button><PhArrowCounterClockwise /> {{ t('party.list.createAgain') }}</Button>
          </CreatePartyDialog>
          <PartyNotificationsDialog v-if="p.canManage.value" :party-id="party.id">
            <Button variant="outline"><PhDiscordLogo /> {{ t('party.notifications.title') }}</Button>
          </PartyNotificationsDialog>
          <Button
            v-if="p.isLeader.value"
            variant="ghost"
            class="text-muted-foreground hover:text-destructive-ink"
            :disabled="!!p.busy.value"
            @click="deleteParty"
          >
            <PhTrash /> {{ t('common.actions.delete') }}
          </Button>
          <Button
            v-else-if="!p.finished.value && p.myMembership.value && p.myMembership.value.status !== 'declined'"
            variant="ghost"
            class="text-muted-foreground"
            @click="leave"
          >
            <PhSignOut />
            {{
              p.myMembership.value.status === 'pending'
                ? t('party.view.leave.cancel')
                : p.myMembership.value.status === 'invited'
                  ? t('party.view.leave.decline')
                  : t('party.view.leave.leave')
            }}
          </Button>
        </div>
      </header>

      <div
        v-if="p.finished.value"
        role="status"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/60 p-3 text-sm"
      >
        <PhFlagCheckered :size="18" class="text-muted-foreground" aria-hidden="true" />
        <span class="flex-1">
          <i18n-t keypath="party.view.finishedBanner" tag="span">
            <template #finished>
              <b class="font-semibold">{{ t('party.view.finishedTag') }}</b>
            </template>
            <template #date>{{ finishedLabel }}</template>
          </i18n-t>
        </span>
      </div>

      <p v-if="p.error.value" role="alert" class="flex items-center gap-2 text-sm text-destructive-ink">
        <PhWarningCircle :size="18" /> {{ p.error.value }}
      </p>

      <!-- Convidado: aceitar ou recusar -->
      <div
        v-if="p.myMembership.value?.status === 'invited'"
        role="status"
        :class="cn(`faction-${party.faction}`, 'flex flex-wrap items-center gap-3 rounded-2xl border border-faction/60 bg-faction-soft/60 p-4')"
      >
        <PhEnvelopeOpen :size="22" class="flex-none text-faction-ink" aria-hidden="true" />
        <p class="min-w-0 flex-1">
          <i18n-t keypath="party.view.invitedBanner" tag="span">
            <template #invited>
              <span class="font-semibold">{{ t('party.view.invitedTag') }}</span>
            </template>
            <template #name>
              <span class="font-semibold">{{ p.myMembership.value.linked.character.name }}</span>
            </template>
          </i18n-t>
        </p>
        <div class="flex gap-2">
          <Button variant="ghost" :disabled="!!p.busy.value" @click="leave">{{ t('party.view.declineShort') }}</Button>
          <Button :disabled="!!p.busy.value || full" @click="p.acceptInvite(p.myMembership.value.id)">
            <PhCircleNotch v-if="p.busy.value === p.myMembership.value.id" class="animate-spin" />
            {{ t('party.view.acceptInvite') }}
          </Button>
        </div>
      </div>

      <!-- Composição -->
      <section aria-labelledby="roster-title" class="space-y-4">
        <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="roster-title" class="font-display text-2xl font-semibold">
            {{ t('party.view.roster') }}
            <span class="ml-1 text-muted-foreground tabular-nums">{{ p.accepted.value.length }}/{{ party.sanctuary.groupSize }}</span>
          </h2>
          <dl class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div v-for="role in ROLE_ORDER" :key="role" class="flex items-baseline gap-1.5">
              <dd class="font-display text-lg font-semibold tabular-nums">{{ comp[role] }}</dd>
              <dt class="text-muted-foreground">{{ ROLE_LABEL[role] }}</dt>
            </div>
          </dl>
        </div>

        <p v-if="p.canManage.value && p.accepted.value.length > 1" class="-mt-2 text-[13px] text-muted-foreground">
          <i18n-t keypath="party.view.dragHint" tag="span">
            <template #handle><PhDotsSixVertical class="inline align-[-2px]" aria-hidden="true" /></template>
          </i18n-t>
        </p>
        <p class="sr-only" aria-live="assertive">{{ dragStatus }}</p>

        <div :class="cn('grid gap-4 md:grid-cols-2', dragMode && 'select-none')">
          <div
            v-for="(group, gi) in roster"
            :key="gi"
            :class="cn(`faction-${party.faction}`, 'rounded-2xl border bg-card/60 px-4 py-2')"
          >
            <h3 class="pt-2 pb-1 text-sm font-medium text-muted-foreground">{{ t('party.view.group', { n: gi + 1 }) }}</h3>
            <ul class="divide-y divide-border/60">
              <li
                v-for="(member, si) in group"
                :key="member?.id ?? `empty-${gi}-${si}`"
                :data-slot-index="gi * GROUP_SIZE + si"
                :class="
                  cn(
                    'flex items-center gap-1 rounded-lg transition-colors',
                    // Líder: a linha inteira é arrastável (no toque, segurar e arrastar).
                    p.canManage.value && member && 'cursor-grab select-none [-webkit-touch-callout:none] hover:bg-accent/40 active:cursor-grabbing',
                    dragFrom != null && dragOver === gi * GROUP_SIZE + si && dragFrom !== dragOver &&
                      'bg-primary/10 ring-2 ring-primary',
                    dragFrom === gi * GROUP_SIZE + si && 'opacity-40',
                  )
                "
                @pointerdown="p.canManage.value && member && onPointerDown($event, gi * GROUP_SIZE + si)"
              >
                <button
                  v-if="p.canManage.value && member"
                  type="button"
                  :class="
                    cn(
                      '-ml-2 grid h-11 w-8 flex-none cursor-grab touch-none place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing',
                      dragMode === 'keyboard' && dragFrom === gi * GROUP_SIZE + si && 'bg-accent text-foreground',
                    )
                  "
                  :aria-label="t('party.view.move', { name: member.linked.character.name, slot: slotName(gi * GROUP_SIZE + si) })"
                  :aria-pressed="dragMode === 'keyboard' && dragFrom === gi * GROUP_SIZE + si"
                  data-drag-handle
                  @keydown="onKeyDown($event, gi * GROUP_SIZE + si)"
                >
                  <PhDotsSixVertical :size="18" weight="bold" />
                </button>
                <span v-else-if="p.canManage.value" class="-ml-2 w-8 flex-none" aria-hidden="true" />

                <div class="min-w-0 flex-1">
                  <CharacterCard v-if="member" :character="member.linked.character" size="sm" :role="roleLabel(member)">
                    <template #actions>
                      <span class="hidden text-xs text-muted-foreground sm:inline">{{ member.ownerName }}</span>
                      <InspectCharacter :character="member.linked.character">
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-8 text-muted-foreground"
                          :aria-label="t('party.players.inspect', { name: member.linked.character.name })"
                          :title="t('party.players.inspect', { name: member.linked.character.name })"
                        >
                          <PhEye />
                        </Button>
                      </InspectCharacter>
                      <Button
                        v-if="p.canManage.value && member.linked.linkId !== party.leaderCharacterLinkId"
                        size="icon"
                        variant="ghost"
                        class="size-8 text-muted-foreground hover:text-destructive-ink"
                        :aria-label="t('party.view.removeName', { name: member.linked.character.name })"
                        :disabled="!!p.busy.value"
                        @click="removeMember(member)"
                      >
                        <PhX />
                      </Button>
                    </template>
                  </CharacterCard>
                  <div v-else class="flex items-center gap-3 py-2.5 text-sm text-muted-foreground">
                    <span class="size-11 flex-none rounded-lg border-2 border-dashed" aria-hidden="true" />
                    {{ t('party.view.emptySlot') }}
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Cartão que acompanha o dedo/mouse enquanto arrasta. -->
      <div
        v-if="dragMode === 'pointer' && dragged"
        class="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border bg-popover px-3 py-2 text-sm font-semibold shadow-lg"
        :style="{ left: `${dragPointer.x}px`, top: `${dragPointer.y}px` }"
        aria-hidden="true"
      >
        <PhDotsSixVertical class="text-muted-foreground" />
        {{ dragged.linked.character.name }}
        <span v-if="dragOver != null" class="font-normal text-muted-foreground">→ {{ slotName(dragOver) }}</span>
      </div>

      <PartyBestTime
        v-if="!p.finished.value && (p.isLeader.value || p.myMembership.value?.status === 'accepted')"
        :members="p.accepted.value"
        :routine="party.routine"
        :availability="availability"
      />

      <PartySchedule
        v-if="p.isLeader.value || p.myMembership.value?.status === 'accepted'"
        :party-id="party.id"
        :members="p.accepted.value"
        :is-leader="p.canManage.value"
        :my-member-id="!p.finished.value && p.myMembership.value?.status === 'accepted' ? p.myMembership.value.id : null"
        :suggested="nextRoutineDate"
        :options="scheduleOptions"
        :routine="party.routine"
        @routine-changed="p.load()"
      />

      <!-- Líder: pedidos -->
      <section v-if="p.canManage.value" aria-labelledby="requests-title" class="space-y-3">
        <h2 id="requests-title" class="font-display text-2xl font-semibold">{{ t('party.view.requests') }}</h2>
        <p v-if="!p.pending.value.length" class="text-sm text-muted-foreground">
          {{ t('party.view.noRequests') }}
        </p>
        <ul v-else class="divide-y divide-border/60 rounded-2xl border bg-card/60 px-4">
          <li v-for="m in p.pending.value" :key="m.id">
            <CharacterCard :character="m.linked.character" size="sm" :role="m.ownerName">
              <template #actions>
                <InspectCharacter :character="m.linked.character">
                  <Button size="sm" variant="ghost" :aria-label="t('party.players.inspect', { name: m.linked.character.name })">
                    <PhEye aria-hidden="true" /><span class="max-sm:hidden">{{ t('party.view.inspect') }}</span>
                  </Button>
                </InspectCharacter>
                <Button
                  size="sm"
                  variant="ghost"
                  :disabled="!!p.busy.value"
                  @click="p.decline(m.id)"
                >
                  {{ t('party.view.declineShort') }}
                </Button>
                <Button size="sm" :disabled="full || !!p.busy.value" @click="p.accept(m.id)">
                  <PhCircleNotch v-if="p.busy.value === m.id" class="animate-spin" />
                  {{ t('party.view.accept') }}
                </Button>
              </template>
            </CharacterCard>
          </li>
        </ul>
      </section>

      <!-- Líder: convites enviados -->
      <section v-if="p.canManage.value" aria-labelledby="invites-title" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="invites-title" class="font-display text-2xl font-semibold">{{ t('party.view.invites') }}</h2>
          <div class="flex flex-wrap gap-2">
            <AnnounceDiscordButton :party-id="party.id" :invited-count="p.invited.value.length" />
            <Button size="sm" variant="outline" as-child>
              <RouterLink :to="{ name: 'players', query: { party: party.id } }"><PhUserPlus /> {{ t('party.view.invitePlayers') }}</RouterLink>
            </Button>
          </div>
        </div>
        <p v-if="!p.invited.value.length" class="text-sm text-muted-foreground">
          {{ t('party.view.noInvites') }}
        </p>
        <ul v-else class="divide-y divide-border/60 rounded-2xl border bg-card/60 px-4">
          <li v-for="m in p.invited.value" :key="m.id">
            <CharacterCard :character="m.linked.character" size="sm" :role="m.ownerName">
              <template #actions>
                <span class="hidden text-xs text-muted-foreground sm:inline">{{ t('party.view.waiting') }}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive-ink"
                  :disabled="!!p.busy.value"
                  @click="p.removeMember(m.id)"
                >
                  {{ t('party.view.cancelInvite') }}
                </Button>
              </template>
            </CharacterCard>
          </li>
        </ul>
      </section>

      <!-- Visitante: pedir vaga -->
      <section
        v-if="!p.finished.value && !p.isLeader.value && canRequest"
        aria-labelledby="join-title"
        class="space-y-3 rounded-2xl border bg-card/60 p-4 sm:p-6"
      >
        <h2 id="join-title" class="font-display text-2xl font-semibold">{{ t('party.find.request') }}</h2>
        <p v-if="p.myMembership.value?.status === 'declined'" class="text-sm text-destructive-ink">
          {{ t('party.view.declinedBefore') }}
        </p>
        <p v-if="full" class="text-sm text-muted-foreground">{{ t('party.view.full') }}</p>
        <p v-else-if="!characters.items.length" class="text-sm text-muted-foreground">
          <i18n-t keypath="party.view.needCharacter" tag="span">
            <template #link>
              <RouterLink to="/me" class="font-medium text-foreground underline">{{ t('party.create.myCharacters') }}</RouterLink>
            </template>
          </i18n-t>
        </p>
        <div v-else-if="joinBlocked" role="status" class="space-y-3">
          <p class="flex items-start gap-2 text-sm">
            <PhWarningCircle :size="18" class="mt-0.5 flex-none text-warning-ink" aria-hidden="true" />
            {{ joinBlocked }}
          </p>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" as-child>
              <RouterLink :to="{ name: 'find-parties' }">{{ t('party.list.find') }}</RouterLink>
            </Button>
            <CreatePartyDialog />
          </div>
        </div>
        <form
          v-else
          class="flex flex-col gap-2 sm:flex-row"
          @submit.prevent="p.requestJoin(joinCharacter)"
        >
          <Select v-model="joinCharacter">
            <SelectTrigger class="w-full bg-background sm:w-72" :aria-label="t('party.find.character')">
              <SelectValue :placeholder="t('party.create.characterPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in joinOptions" :key="o.linked.linkId" :value="o.linked.linkId" :disabled="!o.ok">
                {{ o.linked.character.name }}
                <span class="text-muted-foreground">{{ o.reason ?? o.linked.character.serverName }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" :disabled="!joinCharacter || !!p.busy.value">
            <PhCircleNotch v-if="p.busy.value === 'join'" class="animate-spin" />
            {{ t('party.view.requestJoin') }}
          </Button>
        </form>
      </section>

      <p v-else-if="p.myMembership.value?.status === 'pending'" class="text-muted-foreground">
        {{ t('party.view.pendingNotice', { name: p.myMembership.value.linked.character.name }) }}
      </p>
    </template>
  </div>
</template>
