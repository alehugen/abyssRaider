import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { getContainer, overrideContainer } from '@/app/container'
import type { PartyMember } from '@/contexts/party/domain/Party'
import type { TimeWindow } from '../domain/Availability'
import { usePartyAvailability } from './usePartyAvailability'

const member = (ownerId: string) => ({ id: ownerId, linked: { ownerId } }) as unknown as PartyMember
const win = (start: number): TimeWindow[] => [{ weekday: 3, start, end: start + 120 }] as unknown as TimeWindow[]

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('usePartyAvailability', () => {
  it('resposta atrasada (membros antigos) não sobrescreve a mais nova', async () => {
    const slow = deferred<Map<string, TimeWindow[]>>()
    const listByOwners = vi
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(new Map([['b', win(600)]]))
    overrideContainer({ availabilityRepository: { ...getContainer().availabilityRepository, listByOwners } })

    const members = ref([member('a')])
    const a = usePartyAvailability(members)
    members.value = [member('b')]
    await flushPromises()
    slow.resolve(new Map([['a', win(60)]]))
    await flushPromises()
    expect([...a.byOwner.value.keys()]).toEqual(['b'])
  })

  it('não consulta quando a disponibilidade não vai aparecer (visitante, party finalizada)', async () => {
    const listByOwners = vi.fn(async () => new Map())
    overrideContainer({ availabilityRepository: { ...getContainer().availabilityRepository, listByOwners } })
    const enabled = ref(false)
    usePartyAvailability(() => [member('a')], () => enabled.value)
    await flushPromises()
    expect(listByOwners).not.toHaveBeenCalled()
    enabled.value = true
    await flushPromises()
    expect(listByOwners).toHaveBeenCalledTimes(1)
  })
})
