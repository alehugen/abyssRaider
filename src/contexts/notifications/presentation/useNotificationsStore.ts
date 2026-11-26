import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { usePartiesStore } from '@/contexts/party/presentation/usePartiesStore'
import { errorMessage } from '@/shared/lib/errorMessage'
import { onAppResume } from '@/shared/presentation/useRefreshOnResume'
import type { AppNotification } from '../domain/Notification'

/** Rede de segurança caso o tempo real caia: confere a cada minuto (só com o app na tela). */
const POLL_MS = 60_000
/** Quantas o sino guarda (a consulta e o tempo real usam o mesmo limite: o contador bate). */
export const BELL_LIMIT = 50

/** Notificações da conta logada, atualizadas em tempo real. */
export const useNotificationsStore = defineStore('notifications', () => {
  const items = shallowRef<AppNotification[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const unread = computed(() => items.value.filter((n) => !n.readAt).length)

  const repo = () => getContainer().notificationRepository
  let seq = 0
  /** Chegaram em tempo real (por id): uma consulta que saiu antes não sabe delas. */
  const arrived = new Map<number, AppNotification>()
  let stop: (() => void) | null = null

  async function refresh() {
    const userId = useAuthStore().user?.id
    if (!userId) return
    const mine = ++seq
    arrived.clear()
    try {
      const list = await repo().list(userId, BELL_LIMIT)
      if (mine !== seq || useAuthStore().user?.id !== userId) return // resposta velha ou trocou de conta
      const missing = [...arrived.values()].filter((n) => !list.some((x) => x.id === n.id))
      items.value = [...missing, ...list].slice(0, BELL_LIMIT)
      loaded.value = true
      error.value = null
    } catch (e) {
      if (mine === seq) error.value = errorMessage(e)
    }
  }

  function add(n: AppNotification) {
    arrived.set(n.id, n)
    if (items.value.some((x) => x.id === n.id)) return
    items.value = [n, ...items.value].slice(0, BELL_LIMIT)
    // Convite, aceite, recusa ou raid: a lista de parties mudou.
    const parties = usePartiesStore()
    if (parties.loaded) void parties.load()
  }

  function markLocal(ids: ReadonlySet<number> | null) {
    const now = new Date()
    items.value = items.value.map((n) => (!n.readAt && (!ids || ids.has(n.id)) ? { ...n, readAt: now } : n))
  }

  /** Falhou: mostra o erro e volta ao estado real do servidor. */
  async function rollback(e: unknown) {
    const message = errorMessage(e)
    await refresh()
    error.value = message
  }

  async function markRead(ids: readonly number[]) {
    const unreadIds = ids.filter((id) => items.value.some((n) => n.id === id && !n.readAt))
    if (!unreadIds.length) return
    markLocal(new Set(unreadIds))
    await repo().markRead(unreadIds).catch(rollback)
  }

  async function markAllRead() {
    const userId = useAuthStore().user?.id
    if (!userId || !unread.value) return
    markLocal(null)
    await repo().markAllRead(userId).catch(rollback)
  }

  /** Liga para a conta logada (troca junto com a conta). Chamado pelo sino. */
  function start() {
    if (stop) return
    let unsubscribe: (() => void) | null = null

    const stopWatch = watch(
      () => useAuthStore().user?.id,
      (userId) => {
        unsubscribe?.()
        unsubscribe = null
        items.value = []
        loaded.value = false
        error.value = null
        if (!userId) return
        void refresh()
        try {
          // Ao conectar, confere de novo: o que chegou antes da conexão não vem pelo tempo real.
          unsubscribe = repo().subscribe(userId, add, () => void refresh())
        } catch (e) {
          console.warn('[notificações] tempo real indisponível, só consulta periódica', e)
        }
      },
      { immediate: true },
    )
    // Polling só com o app na tela; ao voltar (ou reconectar) confere na hora.
    const timer = setInterval(() => document.visibilityState !== 'hidden' && void refresh(), POLL_MS)
    const stopResume = onAppResume(() => void refresh())

    stop = () => {
      stopWatch()
      unsubscribe?.()
      clearInterval(timer)
      stopResume()
      stop = null
    }
  }

  return { items, loaded, error, unread, refresh, markRead, markAllRead, start, stop: () => stop?.(), add }
})
