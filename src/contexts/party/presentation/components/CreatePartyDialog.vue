<script setup lang="ts">
import { errorMessage } from '@/shared/lib/errorMessage'
import { PhCircleNotch, PhPlus } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/contexts/character/presentation/useCharactersStore'
import { Button } from '@/shared/presentation/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/presentation/ui/dialog'
import { Input } from '@/shared/presentation/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/presentation/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/shared/presentation/ui/toggle-group'
import { formatDays, isValidTime, normalizeDays, WEEKDAYS, type RaidRoutine } from '../../domain/RaidRoutine'
import { eligibility } from '../../domain/Sanctuary'
import { formatNextRaid } from '../routineFormat'
import { APP_TIME_ZONE, TZ_LABEL } from '@/shared/lib/brasilia'
import { usePartiesStore } from '../usePartiesStore'
import { useRaidApplicationsStore } from '../useRaidApplicationsStore'

const router = useRouter()
const characters = useCharactersStore()
const raid = useRaidApplicationsStore()
const parties = usePartiesStore()

const open = ref(false)
const name = ref('')
const sanctuaryId = ref<string>('')
const characterLinkId = ref<string>('')
const submitting = ref(false)
const error = ref<string | null>(null)

// Rotina: dias da semana (strings para o ToggleGroup) e horário de início no fuso de quem cria.
const raidDays = ref<string[]>([])
const raidTime = ref('21:00')
const timeZone = APP_TIME_ZONE
const routine = computed<RaidRoutine>(() => ({
  days: normalizeDays(raidDays.value.map(Number)),
  time: raidTime.value,
  timeZone,
}))
const routineValid = computed(() => routine.value.days.length > 0 && isValidTime(routine.value.time))
const routinePreview = computed(() => {
  if (!routineValid.value) return null
  const next = formatNextRaid(routine.value)
  const days = formatDays(routine.value.days)
  return `${days.charAt(0).toUpperCase()}${days.slice(1)} às ${routine.value.time}.${next ? ` Próxima: ${next}.` : ''}`
})

const sanctuary = computed(() => raid.sanctuaries.find((s) => s.id === sanctuaryId.value) ?? null)

const characterOptions = computed(() =>
  characters.items.map((linked) => {
    const check = sanctuary.value ? eligibility(linked.character, sanctuary.value) : { ok: true as const }
    return { linked, ok: check.ok, reason: check.ok ? null : check.reason }
  }),
)

const selectedCharacter = computed(() => characterOptions.value.find((o) => o.linked.linkId === characterLinkId.value))
const canSubmit = computed(
  () =>
    name.value.trim().length >= 2 &&
    sanctuary.value &&
    selectedCharacter.value?.ok &&
    routineValid.value &&
    !submitting.value,
)

watch(open, async (isOpen) => {
  if (!isOpen) return
  error.value = null
  await Promise.all([raid.load(), characters.loaded ? null : characters.load()])
  sanctuaryId.value ||= raid.sanctuaries[0]?.id ?? ''
  characterLinkId.value ||= characterOptions.value.find((o) => o.ok)?.linked.linkId ?? ''
})

async function submit() {
  if (!canSubmit.value || !sanctuary.value) return
  submitting.value = true
  error.value = null
  try {
    const id = await parties.create({
      name: name.value.trim(),
      sanctuaryId: sanctuary.value.id,
      characterLinkId: characterLinkId.value,
      routine: routine.value,
    })
    open.value = false
    name.value = ''
    raidDays.value = []
    await router.push({ name: 'party', params: { id } })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <PhPlus />
        Criar party
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">Criar party</DialogTitle>
        <DialogDescription>
          Você vira o líder. Depois é só mandar o link da party ou recrutar quem aplicou no santuário.
        </DialogDescription>
      </DialogHeader>

      <p v-if="!characters.items.length && characters.loaded" class="text-sm text-muted-foreground">
        Vincule um personagem em <RouterLink to="/me" class="font-medium text-foreground underline">Meus personagens</RouterLink>
        antes de criar uma party.
      </p>

      <form v-else class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-1.5">
          <span class="text-sm font-medium">Nome</span>
          <Input v-model="name" maxlength="40" placeholder="Ex.: Ludra de quinta" autocomplete="off" />
        </label>

        <div class="space-y-1.5">
          <span id="sanctuary-label" class="text-sm font-medium">Santuário</span>
          <Select v-model="sanctuaryId">
            <SelectTrigger class="w-full" aria-labelledby="sanctuary-label">
              <SelectValue placeholder="Escolha o santuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="s in raid.sanctuaries" :key="s.id" :value="s.id">{{ s.name }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <fieldset class="space-y-1.5">
          <legend class="text-sm font-medium">Dias de raid</legend>
          <ToggleGroup
            v-model="raidDays"
            type="multiple"
            variant="outline"
            class="grid w-full grid-cols-7"
            aria-label="Dias da semana"
          >
            <ToggleGroupItem
              v-for="d in WEEKDAYS"
              :key="d.value"
              :value="String(d.value)"
              :aria-label="d.long"
              class="px-0 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {{ d.short }}
            </ToggleGroupItem>
          </ToggleGroup>
        </fieldset>

        <label class="block space-y-1.5">
          <span class="text-sm font-medium">Horário de início <span class="font-normal text-muted-foreground">({{ TZ_LABEL }})</span></span>
          <Input v-model="raidTime" type="time" required class="w-36" />
        </label>
        <p class="-mt-2 text-[13px] text-muted-foreground">
          {{ routinePreview ?? 'Escolha ao menos um dia.' }}
        </p>

        <div class="space-y-1.5">
          <span id="leader-label" class="text-sm font-medium">Seu personagem na party</span>
          <Select v-model="characterLinkId">
            <SelectTrigger class="w-full" aria-labelledby="leader-label">
              <SelectValue placeholder="Escolha o personagem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="o in characterOptions"
                :key="o.linked.linkId"
                :value="o.linked.linkId"
                :disabled="!o.ok"
              >
                {{ o.linked.character.name }}
                <span class="text-muted-foreground">{{ o.linked.character.serverName }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="selectedCharacter && !selectedCharacter.ok" class="text-[13px] text-warning">
            {{ selectedCharacter.reason }}
          </p>
          <p v-else class="text-[13px] text-muted-foreground">
            A party aceita personagens da mesma facção e região que ele.
          </p>
        </div>

        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">Cancelar</Button>
          <Button type="submit" :disabled="!canSubmit">
            <PhCircleNotch v-if="submitting" class="animate-spin" />
            Criar party
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
