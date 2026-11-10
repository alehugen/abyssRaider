<script setup lang="ts">
import { errorMessage } from '@/shared/lib/errorMessage'
import { PhCircleNotch, PhFlagBanner, PhX } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { cn } from '@/shared/lib/utils'
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
import type { ApplicationStatus, RaidApplication } from '../../domain/RaidApplication'
import { eligibility } from '../../domain/Sanctuary'
import { useRaidApplicationsStore } from '../useRaidApplicationsStore'

const props = defineProps<{ linked: LinkedCharacter }>()

const store = useRaidApplicationsStore()
void store.load()

const STATUS: Record<ApplicationStatus, { label: string; class: string }> = {
  pending: { label: 'aguardando líder', class: 'text-muted-foreground' },
  accepted: { label: 'aceito', class: 'text-success' },
  declined: { label: 'recusado', class: 'text-destructive' },
}

const mine = computed(() => store.forCharacter(props.linked.linkId))
const appliedIds = computed(() => new Set(mine.value.map((a) => a.sanctuaryId)))

const options = computed(() =>
  store.sanctuaries.map((s) => {
    const check = eligibility(props.linked.character, s)
    const applied = appliedIds.value.has(s.id)
    return {
      sanctuary: s,
      applied,
      disabled: applied || !check.ok,
      hint: applied ? 'Já aplicado' : check.ok ? null : check.reason,
    }
  }),
)
const hasOpenOption = computed(() => options.value.some((o) => !o.disabled))

const open = ref(false)
const selected = ref<string | null>(null)
const submitting = ref(false)
const dialogError = ref<string | null>(null)
const withdrawing = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  dialogError.value = null
  selected.value = options.value.find((o) => !o.disabled)?.sanctuary.id ?? null
})

async function submit() {
  const sanctuary = store.sanctuaries.find((s) => s.id === selected.value)
  if (!sanctuary) return
  submitting.value = true
  dialogError.value = null
  try {
    await store.apply(props.linked, sanctuary)
    open.value = false
  } catch (e) {
    dialogError.value = errorMessage(e)
  } finally {
    submitting.value = false
  }
}

async function withdraw(application: RaidApplication) {
  withdrawing.value = application.id
  await store.withdraw(application)
  withdrawing.value = null
}

const number = new Intl.NumberFormat('pt-BR')
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span
      v-for="a in mine"
      :key="a.id"
      class="inline-flex items-center gap-1.5 rounded-full bg-faction-soft py-1 pr-1 pl-3 text-[13px]"
    >
      <span class="font-semibold text-faction-ink">{{ store.sanctuaryById(a.sanctuaryId)?.name ?? a.sanctuaryId }}</span>
      <span :class="STATUS[a.status].class">{{ STATUS[a.status].label }}</span>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        :aria-label="`Retirar aplicação em ${store.sanctuaryById(a.sanctuaryId)?.name ?? a.sanctuaryId}`"
        :title="'Retirar aplicação'"
        :disabled="withdrawing === a.id"
        @click="withdraw(a)"
      >
        <PhCircleNotch v-if="withdrawing === a.id" :size="14" class="animate-spin" />
        <PhX v-else :size="14" weight="bold" />
      </button>
    </span>

    <Dialog v-model:open="open">
      <DialogTrigger as-child>
        <Button size="sm" :variant="mine.length ? 'ghost' : 'outline'" :disabled="!store.loaded">
          <PhFlagBanner />
          {{ mine.length ? 'Outro santuário' : 'Aplicar para santuário' }}
        </Button>
      </DialogTrigger>

      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display text-2xl">Aplicar {{ linked.character.name }}</DialogTitle>
          <DialogDescription>
            Escolha o santuário. Os líderes de party veem sua aplicação e podem te chamar para a raid.
          </DialogDescription>
        </DialogHeader>

        <p v-if="!options.length" class="text-sm text-muted-foreground">
          Nenhum santuário aberto para aplicações no momento.
        </p>

        <fieldset v-else class="space-y-2">
          <legend class="sr-only">Santuário</legend>
          <label
            v-for="o in options"
            :key="o.sanctuary.id"
            :class="
              cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
                selected === o.sanctuary.id && 'border-primary bg-primary/10',
                o.disabled && 'cursor-not-allowed opacity-60',
              )
            "
          >
            <input
              v-model="selected"
              type="radio"
              name="sanctuary"
              class="mt-1 size-4 accent-(--primary)"
              :value="o.sanctuary.id"
              :disabled="o.disabled"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-display text-lg leading-tight font-semibold">{{ o.sanctuary.name }}</span>
              <span class="block text-[13px] text-muted-foreground">
                <template v-if="o.sanctuary.minItemLevel">
                  Item level {{ number.format(o.sanctuary.minItemLevel) }} ou mais,
                </template>
                grupo de {{ o.sanctuary.groupSize }}
              </span>
              <span v-if="o.hint" class="mt-1 block text-[13px] text-warning">{{ o.hint }}</span>
            </span>
          </label>
        </fieldset>

        <p v-if="dialogError" role="alert" class="text-sm text-destructive">{{ dialogError }}</p>

        <DialogFooter>
          <Button variant="ghost" @click="open = false">Cancelar</Button>
          <Button :disabled="!selected || !hasOpenOption || submitting" @click="submit">
            <PhCircleNotch v-if="submitting" class="animate-spin" />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <p v-if="store.error" role="alert" class="basis-full text-xs text-destructive">{{ store.error }}</p>
  </div>
</template>
