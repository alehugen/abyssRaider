import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/domain/DomainError'
import { SupabaseRaidEventRepository } from './SupabaseRaidEventRepository'

/** Cliente falso: insert em raid_events devolve o erro dado. */
const clientWithInsertError = (error: { code: string; message: string } | null) =>
  ({ from: () => ({ insert: async () => ({ error }) }) }) as unknown as SupabaseClient

describe('SupabaseRaidEventRepository.schedule', () => {
  it('horário que já tem raid nesta party: mensagem clara em vez de "isso já existe"', async () => {
    const repo = new SupabaseRaidEventRepository(clientWithInsertError({ code: '23505', message: 'duplicate key' }))
    const err = await repo.schedule('p1', [new Date('2030-01-01T00:00:00Z')], null).catch((e) => e)
    expect(err).toBeInstanceOf(DomainError)
    expect((err as DomainError).message).toBe('Já tem raid marcada nesse horário.')
  })

  it('regra do banco (P0001) vira erro de domínio com a mesma mensagem', async () => {
    const repo = new SupabaseRaidEventRepository(clientWithInsertError({ code: 'P0001', message: 'Escolha um horário no futuro.' }))
    await expect(repo.schedule('p1', [new Date()], null)).rejects.toMatchObject({ message: 'Escolha um horário no futuro.' })
  })
})
