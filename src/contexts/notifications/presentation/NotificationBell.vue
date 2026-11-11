<script setup lang="ts">
import {
  PhBell,
  PhCalendarCheck,
  PhCalendarX,
  PhCheckCircle,
  PhChecks,
  PhEnvelopeSimple,
  PhXCircle,
} from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/presentation/ui/popover'
import { describeNotification, timeAgo, type AppNotification, type NotificationTone } from '../domain/Notification'
import { useNotificationsStore } from './useNotificationsStore'

const store = useNotificationsStore()
const router = useRouter()
const open = ref(false)

onMounted(() => store.start())

const TONE: Record<NotificationTone, { icon: Component; class: string }> = {
  invite: { icon: PhEnvelopeSimple, class: 'bg-highlight/15 text-highlight-ink' },
  success: { icon: PhCheckCircle, class: 'bg-success/15 text-success-ink' },
  warning: { icon: PhXCircle, class: 'bg-warning/15 text-warning-ink' },
  raid: { icon: PhCalendarCheck, class: 'bg-primary/15 text-primary-ink' },
  cancel: { icon: PhCalendarX, class: 'bg-destructive/15 text-destructive-ink' },
}

const views = computed(() => store.items.map((n) => ({ n, v: describeNotification(n) })))
const badge = computed(() => (store.unread > 99 ? '99+' : String(store.unread)))

// Atualiza ao abrir (o tempo relativo e qualquer coisa que o tempo real tenha perdido).
const now = ref(new Date())
watch(open, (isOpen) => {
  if (!isOpen) return
  now.value = new Date()
  void store.refresh()
})

async function select(n: AppNotification, link: string | null) {
  open.value = false
  void store.markRead([n.id])
  if (link) await router.push(link)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="relative size-9"
        :aria-label="store.unread ? `Notificações, ${store.unread} não lidas` : 'Notificações'"
      >
        <PhBell :size="20" :weight="store.unread ? 'fill' : 'regular'" />
        <span
          v-if="store.unread"
          class="absolute -top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white tabular-nums ring-2 ring-background"
          aria-hidden="true"
        >
          {{ badge }}
        </span>
      </Button>
    </PopoverTrigger>

    <PopoverContent align="end" class="w-[min(24rem,calc(100vw-1.5rem))] p-0">
      <header class="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 class="font-display text-lg font-semibold">Notificações</h2>
        <Button
          v-if="store.unread"
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs text-muted-foreground"
          @click="store.markAllRead()"
        >
          <PhChecks /> Marcar todas como lidas
        </Button>
      </header>

      <p v-if="!store.loaded && store.error" role="alert" class="px-4 py-6 text-center text-sm text-destructive-ink">
        {{ store.error }}
      </p>
      <div v-else-if="!views.length" class="px-4 py-10 text-center text-sm text-muted-foreground">
        <PhBell :size="28" class="mx-auto mb-2 opacity-50" aria-hidden="true" />
        Nada por aqui ainda. Convites, pedidos e raids marcadas aparecem aqui.
      </div>
      <ul v-else class="scroll-thin max-h-[min(28rem,70dvh)] divide-y overflow-y-auto">
        <li v-for="{ n, v } in views" :key="n.id">
          <button
            type="button"
            :class="
              cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                !n.readAt && 'bg-accent/40',
              )
            "
            @click="select(n, v.link)"
          >
            <span :class="cn('grid size-8 flex-none place-items-center rounded-full', TONE[v.tone].class)" aria-hidden="true">
              <component :is="TONE[v.tone].icon" :size="16" weight="bold" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm leading-snug font-semibold">{{ v.title }}</span>
              <span class="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{{ v.body }}</span>
              <span class="mt-1 block text-xs text-muted-foreground">{{ timeAgo(n.createdAt, now) }}</span>
            </span>
            <span v-if="!n.readAt" class="mt-1.5 size-2 flex-none rounded-full bg-primary"><span class="sr-only">não lida</span></span>
          </button>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
