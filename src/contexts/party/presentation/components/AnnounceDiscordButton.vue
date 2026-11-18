<script setup lang="ts">
import { PhCircleNotch, PhMegaphone } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { getContainer } from '@/app/container'
import { t } from '@/shared/i18n'
import { errorMessage } from '@/shared/lib/errorMessage'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
import { Button } from '@/shared/presentation/ui/button'

/** Líder posta a party no canal do Discord (webhook dos avisos) e marca os convidados pendentes. */
const props = defineProps<{ partyId: string; invitedCount: number }>()

const repo = getContainer().partyNotificationsRepository
const busy = ref(false)
const message = ref<{ ok: boolean; text: string } | null>(null)

async function announce() {
  const n = props.invitedCount
  const ok = await confirm({
    title: t('party.announce.confirmTitle'),
    description: n ? t('party.announce.confirmMentions', n) : t('party.announce.confirmNoMentions'),
    confirmText: t('party.announce.confirm'),
  })
  if (!ok) return
  busy.value = true
  message.value = null
  try {
    const marked = await repo.announce(props.partyId)
    message.value = {
      ok: true,
      text: marked ? t('party.announce.sentMarked', marked) : t('party.announce.sent'),
    }
  } catch (e) {
    message.value = { ok: false, text: errorMessage(e) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <p
      v-if="message"
      :role="message.ok ? 'status' : 'alert'"
      :class="['text-sm', message.ok ? 'text-success-ink' : 'text-destructive-ink']"
    >
      {{ message.text }}
    </p>
    <Button size="sm" variant="outline" :disabled="busy" @click="announce">
      <PhCircleNotch v-if="busy" class="animate-spin" />
      <PhMegaphone v-else />
      {{ t('party.announce.button') }}
    </Button>
  </div>
</template>
