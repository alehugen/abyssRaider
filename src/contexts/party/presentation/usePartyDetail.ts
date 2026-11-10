import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { getContainer } from '@/app/container'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { acceptedMembers, pendingMembers, type Applicant, type PartyDetails } from '../domain/Party'
import { usePartiesStore } from './usePartiesStore'

/** Estado e ações da página de uma party. Cada ação recarrega a party inteira (simples e consistente). */
export function usePartyDetail(partyId: MaybeRefOrGetter<string>) {
  const repo = getContainer().partyRepository
  const auth = useAuthStore()
  const parties = usePartiesStore()

  const details = shallowRef<PartyDetails | null>(null)
  const applicants = shallowRef<Applicant[]>([])
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
  /** Participação do usuário logado (qualquer status). */
  const myMembership = computed(() => members.value.find((m) => m.linked.ownerId === userId.value) ?? null)

  /** Aplicados no santuário que combinam com a party e ainda não estão nela. */
  const recruitable = computed(() => {
    const d = details.value
    if (!d) return []
    const inParty = new Set(d.members.filter((m) => m.status !== 'declined').map((m) => m.linked.linkId))
    return applicants.value.filter(
      (a) =>
        !inParty.has(a.linked.linkId) &&
        a.linked.character.region === d.party.region &&
        a.linked.character.faction === d.party.faction,
    )
  })

  async function load() {
    const id = toValue(partyId)
    error.value = null
    try {
      const found = await repo.get(id)
      details.value = found
      notFound.value = !found
      applicants.value = found && found.party.leaderId === userId.value
        ? await repo.listApplicants(found.party.sanctuary.id)
        : []
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function run(key: string, action: () => Promise<void>): Promise<boolean> {
    busy.value = key
    error.value = null
    try {
      await action()
      parties.invalidate()
      await load()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return false
    } finally {
      busy.value = null
    }
  }

  const id = () => toValue(partyId)

  return {
    details,
    applicants,
    recruitable,
    loading,
    notFound,
    error,
    busy,
    isLeader,
    accepted,
    pending,
    myMembership,
    load,
    requestJoin: (characterLinkId: string) =>
      run('join', () => repo.requestJoin(id(), characterLinkId, userId.value ?? '')),
    accept: (memberId: string) => run(memberId, () => repo.decide(memberId, 'accepted')),
    decline: (memberId: string) => run(memberId, () => repo.decide(memberId, 'declined')),
    removeMember: (memberId: string) => run(memberId, () => repo.removeMember(memberId)),
    recruit: (applicationId: string) => run(applicationId, () => repo.recruit(id(), applicationId)),
    removeParty: () => run('party', () => repo.remove(id())),
  }
}
