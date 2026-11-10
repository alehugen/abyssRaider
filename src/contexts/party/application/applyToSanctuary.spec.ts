import { describe, expect, it, vi } from 'vitest'
import type { LinkedCharacter } from '@/contexts/character/domain/LinkedCharacter'
import { AlreadyAppliedError, NotEligibleError, type RaidApplication } from '../domain/RaidApplication'
import type { RaidApplicationRepository } from '../domain/RaidApplicationRepository'
import { eligibility, type Sanctuary } from '../domain/Sanctuary'
import { applyToSanctuary } from './applyToSanctuary'

const ludra: Sanctuary = { id: 'ludra', name: 'Abyssal Forge: Ludra', minItemLevel: 2800, groupSize: 10 }

function linked(itemLevel?: number): LinkedCharacter {
  return {
    linkId: 'link-1',
    ownerId: 'u1',
    syncedAt: new Date(),
    character: {
      id: 'abc=',
      name: 'Boom',
      faction: 'elyos',
      className: 'Cleric',
      level: 45,
      region: 'la',
      serverId: 1401,
      serverName: 'Siel',
      ...(itemLevel != null ? { itemLevel } : {}),
    },
  }
}

function repo(): RaidApplicationRepository {
  return {
    listByOwner: vi.fn(),
    withdraw: vi.fn(),
    create: vi.fn(async (characterLinkId, sanctuaryId) => ({
      id: 'app-1',
      characterLinkId,
      sanctuaryId,
      status: 'pending' as const,
      createdAt: new Date(),
    })),
  }
}

describe('eligibility', () => {
  it('compara o item level com o mínimo do santuário', () => {
    expect(eligibility({ itemLevel: 3042 }, ludra)).toEqual({ ok: true })
    expect(eligibility({ itemLevel: 2700 }, ludra)).toEqual({ ok: false, reason: expect.stringContaining('Faltam 100') })
    expect(eligibility({}, ludra).ok).toBe(false)
    expect(eligibility({}, { ...ludra, minItemLevel: null })).toEqual({ ok: true })
  })
})

describe('applyToSanctuary', () => {
  it('cria a aplicação quando elegível', async () => {
    const r = repo()
    const app = await applyToSanctuary(r, linked(3042), ludra, [])
    expect(r.create).toHaveBeenCalledWith('link-1', 'ludra')
    expect(app.status).toBe('pending')
  })

  it('barra item level insuficiente', async () => {
    await expect(applyToSanctuary(repo(), linked(2000), ludra, [])).rejects.toBeInstanceOf(NotEligibleError)
  })

  it('barra aplicação duplicada', async () => {
    const existing: RaidApplication[] = [
      { id: 'a', characterLinkId: 'link-1', sanctuaryId: 'ludra', status: 'pending', createdAt: new Date() },
    ]
    await expect(applyToSanctuary(repo(), linked(3042), ludra, existing)).rejects.toBeInstanceOf(AlreadyAppliedError)
  })
})
