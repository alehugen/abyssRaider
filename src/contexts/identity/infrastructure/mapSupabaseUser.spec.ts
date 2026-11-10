import type { User as SupabaseUser } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { mapSupabaseUser } from './mapSupabaseUser'

const base = { id: 'uuid-1', app_metadata: {}, aud: 'authenticated', created_at: '' } as const

describe('mapSupabaseUser', () => {
  it('prefere o global_name do Discord', () => {
    const user = mapSupabaseUser({
      ...base,
      user_metadata: {
        provider_id: '123456789',
        full_name: 'lele#0',
        avatar_url: 'https://cdn.discordapp.com/avatars/1/a.png',
        custom_claims: { global_name: 'Lele' },
      },
    } as SupabaseUser)

    expect(user).toEqual({
      id: 'uuid-1',
      discordId: '123456789',
      displayName: 'Lele',
      avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png',
    })
  })

  it('cai para full_name e depois para um nome padrão', () => {
    expect(mapSupabaseUser({ ...base, user_metadata: { full_name: 'lele' } } as SupabaseUser).displayName).toBe('lele')
    const anon = mapSupabaseUser({ ...base, user_metadata: {} } as SupabaseUser)
    expect(anon.displayName).toBe('Daeva')
    expect(anon.discordId).toBeNull()
    expect(anon.avatarUrl).toBeNull()
  })
})
