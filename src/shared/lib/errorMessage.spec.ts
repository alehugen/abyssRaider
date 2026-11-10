import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('lê Error, string e objetos do Supabase', () => {
    expect(errorMessage(new Error('falhou'))).toBe('falhou')
    expect(errorMessage('texto')).toBe('texto')
    expect(errorMessage({ message: 'permission denied', code: '42501' })).toBe('permission denied')
  })

  it('explica migration pendente', () => {
    expect(errorMessage({ message: 'column sanctuaries.image_url does not exist', code: '42703' })).toContain(
      'rode as migrations',
    )
    expect(
      errorMessage({ message: "Could not find the table 'public.party_notifications' in the schema cache", code: 'PGRST205' }),
    ).toContain('rode as migrations')
  })

  it('nunca devolve [object Object]', () => {
    expect(errorMessage({})).toBe('Algo deu errado. Tente de novo.')
    expect(errorMessage(null)).toBe('Algo deu errado. Tente de novo.')
  })
})
