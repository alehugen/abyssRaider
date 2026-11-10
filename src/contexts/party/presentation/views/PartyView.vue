<script setup lang="ts">
import {
  PhArrowLeft,
  PhCheck,
  PhCircleNotch,
  PhLink,
  PhSignOut,
  PhTrash,
  PhUserPlus,
  PhWarningCircle,
  PhX,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { REGION_LABEL, ROLE_LABEL } from '@/contexts/character/domain/Character'
import CharacterCard from '@/contexts/character/presentation/components/CharacterCard.vue'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { assignRoles, canJoin, composition, groups, ROLE_ORDER, type PartyMember } from '../../domain/Party'
import { usePartyDetail } from '../usePartyDetail'

const route = useRoute()
const router = useRouter()
const partyId = computed(() => String(route.params.id))

const p = usePartyDetail(partyId)
const characters = useCharactersStore()

watch(partyId, () => void p.load(), { immediate: true })
if (!characters.loaded) void characters.load()

const party = computed(() => p.details.value?.party ?? null)
const roster = computed(() => (party.value ? groups(party.value, p.accepted.value) : []))
const comp = computed(() => composition(p.accepted.value, party.value?.sanctuary.groupSize ?? 10))
const assigned = computed(() => assignRoles(p.accepted.value, party.value?.sanctuary.groupSize ?? 10))
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
  if (!party.value || !window.confirm(`Excluir a party ${party.value.name}? Todos os membros saem dela.`)) return
  if (await p.removeParty()) await router.push({ name: 'parties' })
}

async function leave() {
  const m = p.myMembership.value
  if (!m) return
  const text = m.status === 'pending' ? 'Cancelar seu pedido?' : 'Sair desta party?'
  if (window.confirm(text)) await p.removeMember(m.id)
}

function removeMember(m: PartyMember) {
  if (window.confirm(`Remover ${m.linked.character.name} da party?`)) void p.removeMember(m.id)
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
      <header :class="cn(`faction-${party.faction}`, 'flex flex-wrap items-end justify-between gap-4')">
        <div class="min-w-0">
          <h1 class="font-display text-4xl leading-none font-bold break-words">{{ party.name }}</h1>
          <p class="mt-2 text-muted-foreground">
            {{ party.sanctuary.name }}, <span class="text-faction-ink">{{ party.faction === 'elyos' ? 'Elyos' : 'Asmodian' }}</span>,
            {{ REGION_LABEL[party.region] }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" @click="copyLink">
            <PhCheck v-if="copied" />
            <PhLink v-else />
            {{ copied ? 'Link copiado' : 'Copiar link da party' }}
          </Button>
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

        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="(group, gi) in roster"
            :key="gi"
            :class="cn(`faction-${party.faction}`, 'rounded-2xl border bg-card/60 px-4 py-2')"
          >
            <h3 class="pt-2 pb-1 text-sm font-medium text-muted-foreground">Grupo {{ gi + 1 }}</h3>
            <ul class="divide-y divide-border/60">
              <li v-for="(member, si) in group" :key="member?.id ?? `empty-${gi}-${si}`">
                <CharacterCard v-if="member" :character="member.linked.character" size="sm" :role="roleLabel(member)">
                  <template #actions>
                    <span class="hidden text-xs text-muted-foreground sm:inline">{{ member.ownerName }}</span>
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
              </li>
            </ul>
          </div>
        </div>
      </section>

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

      <!-- Líder: recrutar aplicados -->
      <section v-if="p.isLeader.value" aria-labelledby="applicants-title" class="space-y-3">
        <div>
          <h2 id="applicants-title" class="font-display text-2xl font-semibold">Aplicados em {{ party.sanctuary.name }}</h2>
          <p class="text-sm text-muted-foreground">
            Jogadores da mesma facção e região que aplicaram no santuário e ainda não têm grupo.
          </p>
        </div>
        <p v-if="!p.recruitable.value.length" class="text-sm text-muted-foreground">Ninguém disponível agora.</p>
        <ul v-else class="divide-y divide-border/60 rounded-2xl border bg-card/60 px-4">
          <li v-for="a in p.recruitable.value" :key="a.applicationId">
            <CharacterCard :character="a.linked.character" size="sm" :role="a.ownerName">
              <template #actions>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="full || p.busy.value === a.applicationId"
                  @click="p.recruit(a.applicationId)"
                >
                  <PhCircleNotch v-if="p.busy.value === a.applicationId" class="animate-spin" />
                  <PhUserPlus v-else />
                  Recrutar
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
