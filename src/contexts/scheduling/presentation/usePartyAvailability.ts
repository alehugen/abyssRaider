import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { getContainer } from '@/app/container'
import type { PartyMember } from '@/contexts/party/domain/Party'
import { errorMessage } from '@/shared/lib/errorMessage'
import { bestSlots, type Slot, type TimeWindow } from '../domain/Availability'

export interface MemberSlot extends Slot {
  /** Membros (com disponibilidade) que estão fora dessa faixa. */
  out: PartyMember[]
}

/**
 * Disponibilidade dos membros de uma party, carregada uma vez e usada pelo
 * "melhor horário" e pelas sugestões do agendamento.
 */
export function usePartyAvailability(members: MaybeRefOrGetter<readonly PartyMember[]>) {
  const byOwner = shallowRef<Map<string, TimeWindow[]>>(new Map())
  const loaded = shallowRef(false)
  const error = shallowRef<string | null>(null)

  const list = computed(() => toValue(members))
  const ownerIds = computed(() => [...new Set(list.value.map((m) => m.linked.ownerId))].sort())

  watch(
    () => ownerIds.value.join(','),
    async () => {
      error.value = null
      try {
        byOwner.value = await getContainer().availabilityRepository.listByOwners(ownerIds.value)
        loaded.value = true
      } catch (e) {
        error.value = errorMessage(e)
      }
    },
    { immediate: true },
  )

  const windowsOf = (m: PartyMember) => byOwner.value.get(m.linked.ownerId) ?? []
  const withData = computed(() => list.value.filter((m) => windowsOf(m).length))
  const missing = computed(() => list.value.filter((m) => !windowsOf(m).length))

  const slots = computed<MemberSlot[]>(() =>
    bestSlots(withData.value.map(windowsOf), { limit: 3 }).map((s) => {
      const free = new Set(s.people)
      return { ...s, out: withData.value.filter((_, i) => !free.has(i)) }
    }),
  )

  /** Melhor faixa de cada dia da semana (para agendar vários dias), as mais cheias primeiro. */
  const bestPerDay = computed<Slot[]>(() => {
    const all = bestSlots(withData.value.map(windowsOf), { limit: 200 })
    const seen = new Set<number>()
    return all.filter((s) => !seen.has(s.weekday) && seen.add(s.weekday)).slice(0, 5)
  })

  return { byOwner, loaded, error, withData, missing, slots, bestPerDay, windowsOf }
}

export type PartyAvailability = ReturnType<typeof usePartyAvailability>
