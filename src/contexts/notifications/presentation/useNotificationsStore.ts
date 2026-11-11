import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { errorMessage } from '@/shared/lib/errorMessage'
import type { AppNotification } from '../domain/Notification'

/** Rede de segurança caso o tempo real caia: confere a cada minuto e ao voltar para a aba. */
const POLL_MS = 60_000

/** Notificações da conta logada, atualizadas em tempo real. */
export const useNotificationsStore = defineStore('notifications', () => {
  const items = shallowRef<AppNotification[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const unread = computed(() => items.value.filter((n) => !n.readAt).length)

  const repo = () => getContainer().notificationRepository
  let stop: (() => void) | null = null

  async function refresh() {
    const userId = useAuthStore().user?.id
    if (!userId) return
    try {
      items.value = await repo().list(userId)
      loaded.value = true
      error.value = null
    } catch (e) {
      error.value = errorMessage(e)
    }
  }

  function add(n: AppNotification) {
    if (items.value.some((x) => x.id === n.id)) return
    items.value = [n, ...items.value].slice(0, 50)
  }

  function markLocal(ids: ReadonlySet<number> | null) {
    const now = new Date()
    items.value = items.value.map((n) => (!n.readAt && (!ids || ids.has(n.id)) ? { ...n, readAt: now } : n))
  }

  async function markRead(ids: readonly number[]) {
    const unreadIds = ids.filter((id) => items.value.some((n) => n.id === id && !n.readAt))
    if (!unreadIds.length) return
    markLocal(new Set(unreadIds))
    await repo().markRead(unreadIds).catch((e) => (error.value = errorMessage(e)))
  }

  async function markAllRead() {
    const userId = useAuthStore().user?.id
    if (!userId || !unread.value) return
    markLocal(null)
    await repo().markAllRead(userId).catch((e) => (error.value = errorMessage(e)))
  }

  /** Liga para a conta logada (e desliga ao sair). Chamado uma vez pelo sino. */
  function start() {
    if (stop) return
    let unsubscribe: (() => void) | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    const onFocus = () => void refresh()

    const stopWatch = watch(
      () => useAuthStore().user?.id,
      (userId) => {
        unsubscribe?.()
        unsubscribe = null
        items.value = []
        loaded.value = false
        if (!userId) return
        void refresh()
        try {
          unsubscribe = repo().subscribe(userId, add)
        } catch {
          // sem tempo real: o polling abaixo cobre
        }
      },
      { immediate: true },
    )
    timer = setInterval(() => void refresh(), POLL_MS)
    window.addEventListener('focus', onFocus)

    stop = () => {
      stopWatch()
      unsubscribe?.()
      if (timer) clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      stop = null
    }
  }

  return { items, loaded, error, unread, refresh, markRead, markAllRead, start, add }
})
