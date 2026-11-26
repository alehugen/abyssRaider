<script setup lang="ts">
import { PhCircleNotch, PhWarningCircle } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { canJoin, joinBlockedMessage, type Party } from '../../domain/Party'
import CreatePartyDialog from './CreatePartyDialog.vue'

/** Visitante (ou quem teve o pedido recusado) pede uma vaga com um dos seus personagens. */
const props = defineProps<{
  party: Party
  /** O pedido anterior foi recusado. */
  declined: boolean
  full: boolean
  /** Outra ação da página em andamento. */
  busy: boolean
  /** O pedido está sendo enviado. */
  joining: boolean
}>()
const emit = defineEmits<{ request: [characterLinkId: string] }>()

const characters = useCharactersStore()
if (!characters.loaded) void characters.load()

const options = computed(() =>
  characters.items.map((linked) => {
    const check = canJoin(props.party, linked)
    return { linked, ok: check.ok, reason: check.ok ? null : check.reason }
  }),
)
/** Nenhum personagem pode entrar: explica (em vez de só desativar tudo). */
const blocked = computed(() => joinBlockedMessage(props.party, characters.items))

const selected = ref('')
watch(
  options,
  (opts) => {
    if (!opts.some((o) => o.linked.linkId === selected.value && o.ok)) {
      selected.value = opts.find((o) => o.ok)?.linked.linkId ?? ''
    }
  },
  { immediate: true },
)
</script>

<template>
  <section aria-labelledby="join-title" class="space-y-3 rounded-2xl border bg-card/60 p-4 sm:p-6">
    <h2 id="join-title" class="font-display text-2xl font-semibold">{{ t('party.find.request') }}</h2>
    <p v-if="declined" class="text-sm text-destructive-ink">
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
    <div v-else-if="blocked" role="status" class="space-y-3">
      <p class="flex items-start gap-2 text-sm">
        <PhWarningCircle :size="18" class="mt-0.5 flex-none text-warning-ink" aria-hidden="true" />
        {{ blocked }}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" as-child>
          <RouterLink :to="{ name: 'find-parties' }">{{ t('party.list.find') }}</RouterLink>
        </Button>
        <CreatePartyDialog />
      </div>
    </div>
    <form v-else class="flex flex-col gap-2 sm:flex-row" @submit.prevent="emit('request', selected)">
      <Select v-model="selected">
        <SelectTrigger class="w-full bg-background sm:w-72" :aria-label="t('party.find.character')">
          <SelectValue :placeholder="t('party.create.characterPlaceholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="o in options" :key="o.linked.linkId" :value="o.linked.linkId" :disabled="!o.ok">
            {{ o.linked.character.name }}
            <span class="text-muted-foreground">{{ o.reason ?? o.linked.character.serverName }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" :disabled="!selected || busy">
        <PhCircleNotch v-if="joining" class="animate-spin" />
        {{ t('party.view.requestJoin') }}
      </Button>
    </form>
  </section>
</template>
