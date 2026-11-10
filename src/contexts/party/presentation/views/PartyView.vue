<script setup lang="ts">
import {
  PhArrowLeft,
  PhCalendarDots,
  PhCheck,
  PhCircleNotch,
  PhDiscordLogo,
  PhDotsSixVertical,
  PhEye,
  PhLink,
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
import { nextSlotStart } from '@/contexts/scheduling/domain/Availability'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { cn } from '@/shared/lib/utils'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
import { Button } from '@/shared/presentation/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import {
  assignRoles,
  canJoin,
  composition,
  GROUP_SIZE,
  groups,
  moveInLayout,
  ROLE_ORDER,
  type PartyMember,
} from '../../domain/Party'
import { useSlotDrag } from '../useSlotDrag'
import { usePartyDetail } from '../usePartyDetail'
import PartyNotificationsDialog from '../components/PartyNotificationsDialog.vue'
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
const slotName = (i: number) => `grupo ${Math.floor(i / GROUP_SIZE) + 1}, vaga ${(i % GROUP_SIZE) + 1}`
/** Anúncio para leitor de tela no modo teclado. */
const dragStatus = computed(() =>
  dragMode.value === 'keyboard' && dragged.value && dragOver.value != null
    ? `Movendo ${dragged.value.linked.character.name} para ${slotName(dragOver.value)}. Enter solta, Esc cancela.`
    : '',
)
const comp = computed(() => composition(p.accepted.value, party.value?.sanctuary.groupSize ?? 10))
const assigned = computed(() => assignRoles(p.accepted.value, party.value?.sanctuary.groupSize ?? 10))
// Disponibilidade dos membros: melhor horário e sugestões ao agendar a raid da semana.
const availability = usePartyAvailability(() => p.accepted.value)
const scheduleOptions = computed(() =>
  availability.slots.value.map((s) => ({
    date: nextSlotStart(s),
    detail: `${s.people.length} de ${p.accepted.value.length} livres`,
  })),
)

const full = computed(() => !!party.value && p.accepted.value.length >= party.value.sanctuary.groupSize)

function roleLabel(m: PartyMember): string {
  if (party.value && m.linked.linkId === party.value.leaderCharacterLinkId) return 'Líder'
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
    window.prompt('Copie o link da party:', url.toString())
  }
}

async function deleteParty() {
  if (!party.value) return
  const ok = await confirm({
    title: `Excluir ${party.value.name}?`,
    description: 'Todos os membros saem dela e a agenda de raids é apagada. Não dá para desfazer.',
    confirmText: 'Excluir party',
    destructive: true,
  })
  if (!ok) return
  if (await p.removeParty()) await router.push({ name: 'parties' })
}

async function leave() {
  const m = p.myMembership.value
  if (!m) return
  const pending = m.status === 'pending'
  const ok = await confirm({
    title: pending ? 'Cancelar seu pedido?' : 'Sair desta party?',
    description: pending ? undefined : 'Para voltar, você vai precisar pedir vaga de novo.',
    confirmText: pending ? 'Cancelar pedido' : 'Sair',
    cancelText: 'Voltar',
    destructive: !pending,
  })
  if (ok) await p.removeMember(m.id)
}

async function removeMember(m: PartyMember) {
  const ok = await confirm({
    title: `Remover ${m.linked.character.name}?`,
    description: `${m.ownerName} sai da party e das confirmações de presença.`,
    confirmText: 'Remover',
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
      <PhArrowLeft /> Parties
    </RouterLink>

    <div v-if="p.loading.value" class="space-y-4">
      <Skeleton class="h-10 w-64" />
      <Skeleton class="h-64 rounded-2xl" />
    </div>

    <p v-else-if="p.notFound.value" class="text-muted-foreground">
      Esta party não existe mais. O líder pode ter excluído.
    </p>

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
          class="size-full scale-105 object-cover object-[center_20%] opacity-60 blur-[2px] mask-b-from-20% mask-b-to-100%"
        />
        <div class="absolute inset-0 bg-linear-to-r from-background via-background/50 to-background/10" />
      </div>

      <header :class="cn(`faction-${party.faction}`, 'flex flex-wrap items-end justify-between gap-4')">
        <div class="min-w-0">
          <h1 class="font-display text-4xl leading-none font-bold break-words">{{ party.name }}</h1>
          <p class="mt-2 text-muted-foreground">
            {{ party.sanctuary.name }}, <span class="text-faction-ink">{{ party.faction === 'elyos' ? 'Elyos' : 'Asmodian' }}</span>,
            {{ REGION_LABEL[party.region] }}
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
            {{ copied ? 'Link copiado' : 'Copiar link da party' }}
          </Button>
          <PartyNotificationsDialog v-if="p.isLeader.value" :party-id="party.id">
            <Button variant="outline"><PhDiscordLogo /> Avisos no Discord</Button>
          </PartyNotificationsDialog>
          <Button
            v-if="p.isLeader.value"
            variant="ghost"
            class="text-muted-foreground hover:text-destructive"
            :disabled="p.busy.value === 'party'"
            @click="deleteParty"
          >
            <PhTrash /> Excluir
          </Button>
          <Button
            v-else-if="p.myMembership.value && p.myMembership.value.status !== 'declined'"
            variant="ghost"
            class="text-muted-foreground"
            @click="leave"
          >
            <PhSignOut /> {{ p.myMembership.value.status === 'pending' ? 'Cancelar pedido' : 'Sair' }}
          </Button>
        </div>
      </header>

      <p v-if="p.error.value" role="alert" class="flex items-center gap-2 text-sm text-destructive">
        <PhWarningCircle :size="18" /> {{ p.error.value }}
      </p>

      <!-- Composição -->
      <section aria-labelledby="roster-title" class="space-y-4">
        <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="roster-title" class="font-display text-2xl font-semibold">
            Formação
            <span class="ml-1 text-muted-foreground tabular-nums">{{ p.accepted.value.length }}/{{ party.sanctuary.groupSize }}</span>
          </h2>
          <dl class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div v-for="role in ROLE_ORDER" :key="role" class="flex items-baseline gap-1.5">
              <dd class="font-display text-lg font-semibold tabular-nums">{{ comp[role] }}</dd>
              <dt class="text-muted-foreground">{{ ROLE_LABEL[role] }}</dt>
            </div>
          </dl>
        </div>

        <p v-if="p.isLeader.value && p.accepted.value.length > 1" class="-mt-2 text-[13px] text-muted-foreground">
          Arraste pela alça <PhDotsSixVertical class="inline align-[-2px]" aria-hidden="true" /> para trocar jogadores de
          lugar ou de grupo.
        </p>
        <p class="sr-only" aria-live="assertive">{{ dragStatus }}</p>

        <div :class="cn('grid gap-4 md:grid-cols-2', dragMode && 'select-none')">
          <div
            v-for="(group, gi) in roster"
            :key="gi"
            :class="cn(`faction-${party.faction}`, 'rounded-2xl border bg-card/60 px-4 py-2')"
          >
            <h3 class="pt-2 pb-1 text-sm font-medium text-muted-foreground">Grupo {{ gi + 1 }}</h3>
            <ul class="divide-y divide-border/60">
              <li
                v-for="(member, si) in group"
                :key="member?.id ?? `empty-${gi}-${si}`"
                :data-slot-index="gi * GROUP_SIZE + si"
                :class="
                  cn(
                    'flex items-center gap-1 rounded-lg transition-colors',
                    dragFrom != null && dragOver === gi * GROUP_SIZE + si && dragFrom !== dragOver &&
                      'bg-primary/10 ring-2 ring-primary',
                    dragFrom === gi * GROUP_SIZE + si && 'opacity-40',
                  )
                "
              >
                <button
                  v-if="p.isLeader.value && member"
                  type="button"
                  :class="
                    cn(
                      '-ml-2 grid h-11 w-6 flex-none cursor-grab touch-none place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing',
                      dragMode === 'keyboard' && dragFrom === gi * GROUP_SIZE + si && 'bg-accent text-foreground',
                    )
                  "
                  :aria-label="`Mover ${member.linked.character.name} (${slotName(gi * GROUP_SIZE + si)})`"
                  :aria-pressed="dragMode === 'keyboard' && dragFrom === gi * GROUP_SIZE + si"
                  @pointerdown="onPointerDown($event, gi * GROUP_SIZE + si)"
                  @keydown="onKeyDown($event, gi * GROUP_SIZE + si)"
                >
                  <PhDotsSixVertical :size="18" weight="bold" />
                </button>
                <span v-else-if="p.isLeader.value" class="-ml-2 w-6 flex-none" aria-hidden="true" />

                <div class="min-w-0 flex-1">
                  <CharacterCard v-if="member" :character="member.linked.character" size="sm" :role="roleLabel(member)">
                    <template #actions>
                      <span class="hidden text-xs text-muted-foreground sm:inline">{{ member.ownerName }}</span>
                      <InspectCharacter :character="member.linked.character">
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-8 text-muted-foreground"
                          :aria-label="`Inspecionar ${member.linked.character.name}`"
                          :title="`Inspecionar ${member.linked.character.name}`"
                        >
                          <PhEye />
                        </Button>
                      </InspectCharacter>
                      <Button
                        v-if="p.isLeader.value && member.linked.linkId !== party.leaderCharacterLinkId"
                        size="icon"
                        variant="ghost"
                        class="size-8 text-muted-foreground hover:text-destructive"
                        :aria-label="`Remover ${member.linked.character.name}`"
                        :disabled="p.busy.value === member.id"
                        @click="removeMember(member)"
                      >
                        <PhX />
                      </Button>
                    </template>
                  </CharacterCard>
                  <div v-else class="flex items-center gap-3 py-2.5 text-sm text-muted-foreground">
                    <span class="size-11 flex-none rounded-lg border-2 border-dashed" aria-hidden="true" />
                    Vaga livre
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
        v-if="p.isLeader.value || p.myMembership.value?.status === 'accepted'"
        :members="p.accepted.value"
        :routine="party.routine"
        :availability="availability"
      />

      <PartySchedule
        v-if="p.isLeader.value || p.myMembership.value?.status === 'accepted'"
        :party-id="party.id"
        :members="p.accepted.value"
        :is-leader="p.isLeader.value"
        :my-member-id="p.myMembership.value?.status === 'accepted' ? p.myMembership.value.id : null"
        :suggested="nextRoutineDate"
        :options="scheduleOptions"
      />

      <!-- Líder: pedidos -->
      <section v-if="p.isLeader.value" aria-labelledby="requests-title" class="space-y-3">
        <h2 id="requests-title" class="font-display text-2xl font-semibold">Pedidos para entrar</h2>
        <p v-if="!p.pending.value.length" class="text-sm text-muted-foreground">
          Nenhum pedido no momento. Mande o link da party para o seu grupo.
        </p>
        <ul v-else class="divide-y divide-border/60 rounded-2xl border bg-card/60 px-4">
          <li v-for="m in p.pending.value" :key="m.id">
            <CharacterCard :character="m.linked.character" size="sm" :role="m.ownerName">
              <template #actions>
                <InspectCharacter :character="m.linked.character">
                  <Button size="sm" variant="ghost"><PhEye /> Inspecionar</Button>
                </InspectCharacter>
                <Button
                  size="sm"
                  variant="ghost"
                  :disabled="p.busy.value === m.id"
                  @click="p.decline(m.id)"
                >
                  Recusar
                </Button>
                <Button size="sm" :disabled="full || p.busy.value === m.id" @click="p.accept(m.id)">
                  <PhCircleNotch v-if="p.busy.value === m.id" class="animate-spin" />
                  Aceitar
                </Button>
              </template>
            </CharacterCard>
          </li>
        </ul>
      </section>

      <!-- Visitante: pedir vaga -->
      <section
        v-if="!p.isLeader.value && (!p.myMembership.value || p.myMembership.value.status === 'declined')"
        aria-labelledby="join-title"
        class="space-y-3 rounded-2xl border bg-card/60 p-4 sm:p-6"
      >
        <h2 id="join-title" class="font-display text-2xl font-semibold">Pedir vaga</h2>
        <p v-if="p.myMembership.value?.status === 'declined'" class="text-sm text-destructive">
          O líder recusou seu pedido anterior.
        </p>
        <p v-if="full" class="text-sm text-muted-foreground">A party está completa.</p>
        <p v-else-if="!characters.items.length" class="text-sm text-muted-foreground">
          Vincule um personagem em
          <RouterLink to="/me" class="font-medium text-foreground underline">Meus personagens</RouterLink>
          para pedir vaga.
        </p>
        <form
          v-else-if="!p.myMembership.value"
          class="flex flex-col gap-2 sm:flex-row"
          @submit.prevent="p.requestJoin(joinCharacter)"
        >
          <Select v-model="joinCharacter">
            <SelectTrigger class="w-full bg-background sm:w-72" aria-label="Personagem">
              <SelectValue placeholder="Escolha o personagem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in joinOptions" :key="o.linked.linkId" :value="o.linked.linkId" :disabled="!o.ok">
                {{ o.linked.character.name }}
                <span class="text-muted-foreground">{{ o.reason ?? o.linked.character.serverName }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" :disabled="!joinCharacter || p.busy.value === 'join'">
            <PhCircleNotch v-if="p.busy.value === 'join'" class="animate-spin" />
            Pedir para entrar
          </Button>
        </form>
      </section>

      <p v-else-if="p.myMembership.value?.status === 'pending'" class="text-muted-foreground">
        Pedido enviado com {{ p.myMembership.value.linked.character.name }}. Agora é com o líder.
      </p>
    </template>
  </div>
</template>
