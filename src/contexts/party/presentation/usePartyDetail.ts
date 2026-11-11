import { errorMessage } from '@/shared/lib/errorMessage'
import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { acceptedMembers, invitedMembers, pendingMembers, type PartyDetails } from '../domain/Party'
import { usePartiesStore } from './usePartiesStore'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Estado e ações da página de uma party. Cada ação recarrega a party inteira (simples e consistente). */
export function usePartyDetail(partyId: MaybeRefOrGetter<string>) {
  const repo = getContainer().partyRepository
  const auth = useAuthStore()
  const parties = usePartiesStore()

  const details = shallowRef<PartyDetails | null>(null)
  const loading = ref(true)
  const notFound = ref(false)
  const error = ref<string | null>(null)
  /** Id do item com ação em andamento (membro, aplicação ou 'join'/'party'). */
  const busy = ref<string | null>(null)

  const userId = computed(() => auth.user?.id ?? null)
  const isLeader = computed(() => details.value?.party.leaderId === userId.value)
  const members = computed(() => details.value?.members ?? [])
  const accepted = computed(() => acceptedMembers(members.value))
  const pending = computed(() => pendingMembers(members.value))
  const invited = computed(() => invitedMembers(members.value))
  /** Participação do usuário logado (qualquer status). */
  const myMembership = computed(() => members.value.find((m) => m.linked.ownerId === userId.value) ?? null)

  /** Party exibida; trocou (ex.: veio de uma notificação) = começa do zero. */
  let shownId: string | null = null
  /** Só a resposta mais recente vale (uma lenta de outra party não sobrescreve). */
  let seq = 0

  async function load() {
    const id = toValue(partyId)
    const mine = ++seq
    if (id !== shownId) {
      shownId = id
      details.value = null
      notFound.value = false
      loading.value = true
    }
    error.value = null
    try {
      const found = UUID.test(id) ? await repo.get(id) : null
      if (mine !== seq) return
      details.value = found
      notFound.value = !found
    } catch (e) {
      if (mine === seq) error.value = errorMessage(e)
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  /** Uma ação por vez na página (os botões ficam desativados enquanto `busy`). */
  async function run(key: string, action: () => Promise<void>): Promise<boolean> {
    if (busy.value) return false
    busy.value = key
    error.value = null
    try {
      await action()
      parties.invalidate()
      await load()
      return true
    } catch (e) {
      error.value = errorMessage(e)
      return false
    } finally {
      busy.value = null
    }
  }

  const id = () => toValue(partyId)

  return {
    details,
    loading,
    notFound,
    error,
    busy,
    isLeader,
    accepted,
    pending,
    invited,
    myMembership,
    load,
    requestJoin: (characterLinkId: string) =>
      run('join', () => repo.requestJoin(id(), characterLinkId, userId.value ?? '')),
    accept: (memberId: string) => run(memberId, () => repo.decide(memberId, 'accepted')),
    decline: (memberId: string) => run(memberId, () => repo.decide(memberId, 'declined')),
    removeMember: (memberId: string) => run(memberId, () => repo.removeMember(memberId)),
    acceptInvite: (memberId: string) => run(memberId, () => repo.acceptInvite(memberId)),
    removeParty: () => run('party', () => repo.remove(id())),
    setLayout: (layout: ReadonlyArray<{ memberId: string; slot: number }>) =>
      run('layout', () => repo.setLayout(id(), layout)),
  }
}
