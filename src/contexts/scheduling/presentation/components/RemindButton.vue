<script setup lang="ts">
import { PhBellRinging, PhCircleNotch } from '@phosphor-icons/vue'
import { onBeforeUnmount, ref } from 'vue'
import { getContainer } from '@/app/container'
import { errorMessage } from '@/shared/lib/errorMessage'
import { confirm } from '@/shared/presentation/confirm/useConfirm'
import { Button } from '@/shared/presentation/ui/button'

/**
 * Líder: lembrete manual de uma raid. Os membros recebem no sino e, se a party
 * tiver o Discord configurado, o canal recebe a lista marcando quem não respondeu.
 * Usado na agenda da party e na Agenda geral.
 */
const props = defineProps<{ eventId: string; partyName?: string }>()

const busy = ref(false)
const message = ref<{ ok: boolean; text: string } | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function show(ok: boolean, text: string) {
  message.value = { ok, text }
  clearTimeout(timer)
  // Sucesso some sozinho; erro fica até a próxima ação.
  if (ok) timer = setTimeout(() => (message.value = null), 6000)
}
onBeforeUnmount(() => clearTimeout(timer))

async function remind() {
  const ok = await confirm({
    title: props.partyName ? `Lembrar o grupo de ${props.partyName}?` : 'Lembrar o grupo desta raid?',
    description:
      'Os membros recebem o lembrete no sino (menos quem respondeu "Não vou"). Se a party tiver o Discord configurado, o canal recebe quem vai e marca quem ainda não respondeu.',
    confirmText: 'Mandar lembrete',
  })
  if (!ok) return
  busy.value = true
  message.value = null
  try {
    const r = await getContainer().raidEventRepository.remind(props.eventId)
    const people = r.notified === 1 ? '1 membro avisado' : `${r.notified} membros avisados`
    show(true, r.discord ? `Lembrete enviado: ${people} e o canal do Discord.` : `Lembrete enviado: ${people}.`)
  } catch (e) {
    show(false, errorMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span class="inline-flex flex-col items-end gap-1">
    <Button size="sm" variant="ghost" class="text-muted-foreground" :disabled="busy" @click="remind">
      <PhCircleNotch v-if="busy" class="animate-spin" />
      <PhBellRinging v-else />
      Lembrar
    </Button>
    <span
      v-if="message"
      :role="message.ok ? 'status' : 'alert'"
      :class="['max-w-64 text-right text-xs', message.ok ? 'text-success-ink' : 'text-destructive-ink']"
    >
      {{ message.text }}
    </span>
  </span>
</template>
