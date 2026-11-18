<script setup lang="ts">
import { PhCheck, PhCircleNotch, PhDiscordLogo, PhPaperPlaneTilt, PhTrash } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { getContainer } from '@/app/container'
import { t } from '@/shared/i18n'
import { errorMessage } from '@/shared/lib/errorMessage'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
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
import { Switch } from '@/shared/presentation/ui/switch'
import {
  DEFAULT_NOTIFICATIONS,
  isDiscordWebhook,
  REMINDER_OPTIONS,
  type PartyNotifications,
  type ReminderMinutes,
} from '../../domain/PartyNotifications'

/** Configuração dos avisos no Discord. Só aparece para o líder. */
const props = defineProps<{ partyId: string }>()

const repo = getContainer().partyNotificationsRepository

const open = ref(false)
const loading = ref(false)
/** Já existe configuração salva (habilita "Enviar teste" e "Desligar"). */
const saved = ref(false)
const form = ref<PartyNotifications>({ webhookUrl: '', ...DEFAULT_NOTIFICATIONS })
const busy = ref<'save' | 'test' | 'remove' | null>(null)
const error = ref<string | null>(null)
/** Não conseguiu ler a configuração: não deixa salvar (sobrescreveria a real com os padrões). */
const loadFailed = ref(false)
const notice = ref<string | null>(null)

const reminderValue = computed({
  get: () => String(form.value.reminderMinutes),
  set: (v: string) => (form.value.reminderMinutes = Number(v) as ReminderMinutes),
})

const urlOk = computed(() => isDiscordWebhook(form.value.webhookUrl))
const urlTouched = computed(() => form.value.webhookUrl.trim().length > 0)

/** Textos em party.notifications.toggles.<key>.label / .hint (só quem tem dica). */
const TOGGLES = [
  { key: 'scheduled', hint: true },
  { key: 'reminder', hint: true },
  { key: 'cancelled', hint: false },
  { key: 'requests', hint: true },
] as const

watch(open, async (isOpen) => {
  if (!isOpen) return
  error.value = null
  notice.value = null
  loading.value = true
  loadFailed.value = false
  try {
    const current = await repo.get(props.partyId)
    saved.value = !!current
    form.value = current ?? { webhookUrl: '', ...DEFAULT_NOTIFICATIONS }
  } catch (e) {
    error.value = errorMessage(e)
    loadFailed.value = true
  } finally {
    loading.value = false
  }
})

async function run(kind: 'save' | 'test' | 'remove', action: () => Promise<void>, done: string) {
  busy.value = kind
  error.value = null
  notice.value = null
  try {
    await action()
    notice.value = done
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = null
  }
}

function save() {
  if (!urlOk.value) return
  void run(
    'save',
    async () => {
      await repo.save(props.partyId, form.value, window.location.origin)
      saved.value = true
    },
    t('party.notifications.savedNotice'),
  )
}

function test() {
  void run('test', () => repo.test(props.partyId), t('party.notifications.testNotice'))
}

async function remove() {
  const ok = await confirm({
    title: t('party.notifications.offTitle'),
    description: t('party.notifications.offDescription'),
    confirmText: t('party.notifications.off'),
    destructive: true,
  })
  if (!ok) return
  void run(
    'remove',
    async () => {
      await repo.remove(props.partyId)
      saved.value = false
      form.value = { webhookUrl: '', ...DEFAULT_NOTIFICATIONS }
    },
    t('party.notifications.offNotice'),
  )
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 font-display text-2xl">
          <PhDiscordLogo class="text-[#5865F2]" aria-hidden="true" /> {{ t('party.notifications.title') }}
        </DialogTitle>
        <DialogDescription>
          {{ t('party.notifications.description') }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <PhCircleNotch class="animate-spin" /> {{ t('common.actions.loading') }}
      </div>

      <form v-else class="space-y-5" @submit.prevent="save">
        <div class="space-y-1.5">
          <label for="webhook-url" class="text-sm font-medium">{{ t('party.notifications.url') }}</label>
          <Input
            id="webhook-url"
            v-model="form.webhookUrl"
            type="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://discord.com/api/webhooks/…"
            :aria-invalid="urlTouched && !urlOk"
          />
          <p v-if="urlTouched && !urlOk" class="text-[13px] text-warning-ink">
            {{ t('party.notifications.urlInvalid') }}
          </p>
          <details class="text-[13px] text-muted-foreground">
            <summary class="cursor-pointer select-none hover:text-foreground">{{ t('party.notifications.howTo') }}</summary>
            <ol class="mt-1.5 list-decimal space-y-0.5 pl-5">
              <li>{{ t('party.notifications.howToStep1') }}</li>
              <li>{{ t('party.notifications.howToStep2') }}</li>
              <li>{{ t('party.notifications.howToStep3') }}</li>
            </ol>
            <p class="mt-1.5">{{ t('party.notifications.urlSecret') }}</p>
          </details>
        </div>

        <fieldset class="space-y-3">
          <legend class="mb-1 text-sm font-medium">{{ t('party.notifications.when') }}</legend>
          <label v-for="tg in TOGGLES" :key="tg.key" class="flex items-start justify-between gap-4">
            <span>
              <span class="block text-sm">{{ t(`party.notifications.toggles.${tg.key}.label`) }}</span>
              <span v-if="tg.hint" class="block text-xs text-muted-foreground">{{ t(`party.notifications.toggles.${tg.key}.hint`) }}</span>
            </span>
            <Switch v-model="form[tg.key]" />
          </label>

          <div v-if="form.reminder" class="flex items-center justify-between gap-4 pl-0">
            <span id="reminder-label" class="text-sm text-muted-foreground">{{ t('party.notifications.reminderWhen') }}</span>
            <Select v-model="reminderValue">
              <SelectTrigger class="w-44" aria-labelledby="reminder-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="o in REMINDER_OPTIONS" :key="o.value" :value="String(o.value)">
                  {{ o.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <p v-if="error" role="alert" class="text-sm text-destructive-ink">{{ error }}</p>
        <p v-else-if="notice" role="status" class="flex items-center gap-1.5 text-sm text-success-ink">
          <PhCheck /> {{ notice }}
        </p>

        <DialogFooter class="gap-2 sm:justify-between">
          <div class="flex gap-2">
            <Button
              v-if="saved"
              type="button"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive-ink"
              :disabled="!!busy"
              @click="remove"
            >
              <PhTrash /> {{ t('party.notifications.off') }}
            </Button>
            <Button v-if="saved" type="button" variant="outline" :disabled="!!busy" @click="test">
              <PhCircleNotch v-if="busy === 'test'" class="animate-spin" />
              <PhPaperPlaneTilt v-else />
              {{ t('party.notifications.test') }}
            </Button>
          </div>
          <Button type="submit" :disabled="!urlOk || !!busy || loadFailed">
            <PhCircleNotch v-if="busy === 'save'" class="animate-spin" />
            {{ t('common.actions.save') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
