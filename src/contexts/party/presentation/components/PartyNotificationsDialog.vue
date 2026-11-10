<script setup lang="ts">
import { PhCheck, PhCircleNotch, PhDiscordLogo, PhPaperPlaneTilt, PhTrash } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { getContainer } from '@/app/container'
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
const notice = ref<string | null>(null)

const reminderValue = computed({
  get: () => String(form.value.reminderMinutes),
  set: (v: string) => (form.value.reminderMinutes = Number(v) as ReminderMinutes),
})

const urlOk = computed(() => isDiscordWebhook(form.value.webhookUrl))
const urlTouched = computed(() => form.value.webhookUrl.trim().length > 0)

const TOGGLES = [
  { key: 'scheduled', label: 'Raid marcada', hint: 'Menciona os membros da party.' },
  { key: 'reminder', label: 'Lembrete antes da raid', hint: 'Lista quem vai e menciona quem não respondeu.' },
  { key: 'cancelled', label: 'Raid cancelada', hint: null },
  { key: 'requests', label: 'Pedido para entrar', hint: 'Com classe, CP e item level de quem pediu.' },
] as const

watch(open, async (isOpen) => {
  if (!isOpen) return
  error.value = null
  notice.value = null
  loading.value = true
  try {
    const current = await repo.get(props.partyId)
    saved.value = !!current
    form.value = current ?? { webhookUrl: '', ...DEFAULT_NOTIFICATIONS }
  } catch (e) {
    error.value = errorMessage(e)
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
    'Salvo. Use "Enviar teste" para conferir o canal.',
  )
}

function test() {
  void run('test', () => repo.test(props.partyId), 'Mensagem de teste enviada. Confira o canal no Discord.')
}

async function remove() {
  const ok = await confirm({
    title: 'Desligar os avisos no Discord?',
    description: 'O canal para de receber mensagens desta party. Dá para ligar de novo depois.',
    confirmText: 'Desligar',
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
    'Avisos desligados.',
  )
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 font-display text-2xl">
          <PhDiscordLogo class="text-[#5865F2]" aria-hidden="true" /> Avisos no Discord
        </DialogTitle>
        <DialogDescription>
          O AbyssRaider posta num canal do seu servidor quando algo acontece na party. Os horários vão no horário de
          Brasília.
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <PhCircleNotch class="animate-spin" /> Carregando…
      </div>

      <form v-else class="space-y-5" @submit.prevent="save">
        <div class="space-y-1.5">
          <label for="webhook-url" class="text-sm font-medium">URL do webhook do canal</label>
          <Input
            id="webhook-url"
            v-model="form.webhookUrl"
            type="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://discord.com/api/webhooks/…"
            :aria-invalid="urlTouched && !urlOk"
          />
          <p v-if="urlTouched && !urlOk" class="text-[13px] text-warning">
            Essa não parece uma URL de webhook do Discord.
          </p>
          <details class="text-[13px] text-muted-foreground">
            <summary class="cursor-pointer select-none hover:text-foreground">Como pegar a URL</summary>
            <ol class="mt-1.5 list-decimal space-y-0.5 pl-5">
              <li>No Discord, abra as configurações do canal (engrenagem ao lado do nome).</li>
              <li>Integrações, depois Webhooks, depois Novo webhook.</li>
              <li>Clique em Copiar URL do webhook e cole aqui.</li>
            </ol>
            <p class="mt-1.5">Só o líder vê essa URL: com ela qualquer um consegue postar no canal.</p>
          </details>
        </div>

        <fieldset class="space-y-3">
          <legend class="mb-1 text-sm font-medium">Avisar quando</legend>
          <label v-for="t in TOGGLES" :key="t.key" class="flex items-start justify-between gap-4">
            <span>
              <span class="block text-sm">{{ t.label }}</span>
              <span v-if="t.hint" class="block text-xs text-muted-foreground">{{ t.hint }}</span>
            </span>
            <Switch v-model="form[t.key]" />
          </label>

          <div v-if="form.reminder" class="flex items-center justify-between gap-4 pl-0">
            <span id="reminder-label" class="text-sm text-muted-foreground">Quando lembrar</span>
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

        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <p v-else-if="notice" role="status" class="flex items-center gap-1.5 text-sm text-success">
          <PhCheck /> {{ notice }}
        </p>

        <DialogFooter class="gap-2 sm:justify-between">
          <div class="flex gap-2">
            <Button
              v-if="saved"
              type="button"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive"
              :disabled="!!busy"
              @click="remove"
            >
              <PhTrash /> Desligar
            </Button>
            <Button v-if="saved" type="button" variant="outline" :disabled="!!busy" @click="test">
              <PhCircleNotch v-if="busy === 'test'" class="animate-spin" />
              <PhPaperPlaneTilt v-else />
              Enviar teste
            </Button>
          </div>
          <Button type="submit" :disabled="!urlOk || !!busy">
            <PhCircleNotch v-if="busy === 'save'" class="animate-spin" />
            Salvar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
