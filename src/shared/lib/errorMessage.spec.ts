import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomainError } from '@/shared/domain/DomainError'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('passa direto só o que já está em português', () => {
    expect(errorMessage('texto')).toBe('texto')
    expect(errorMessage({ message: 'A party já está completa.', code: 'P0001' })).toBe('A party já está completa.')
    expect(errorMessage(new DomainError('x', 'Limite de 12 personagens por conta.'))).toBe('Limite de 12 personagens por conta.')
    const http = Object.assign(new Error('Personagem não encontrado'), { name: 'HttpError' })
    expect(errorMessage(http)).toBe('Personagem não encontrado')
  })

  it('traduz erros conhecidos do Supabase e da rede', () => {
    expect(errorMessage({ message: 'new row violates row-level security policy for table "x"', code: '42501' })).toBe(
      'Você não tem permissão para fazer isso.',
    )
    expect(errorMessage({ message: 'JWT expired', code: 'PGRST301' })).toBe('Sua sessão expirou. Entre de novo.')
    expect(errorMessage({ message: 'invalid input syntax for type uuid: "abc"', code: '22P02' })).toBe('Link ou dado inválido.')
    expect(errorMessage(new TypeError('Failed to fetch'))).toContain('Sem conexão')
    expect(errorMessage(Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }))).toContain('Demorou demais')
  })

  it('explica migration pendente', () => {
    expect(errorMessage({ message: 'column sanctuaries.image_url does not exist', code: '42703' })).toContain('rode as migrations')
    expect(errorMessage({ message: "Could not find the table 'public.x'", code: 'PGRST205' })).toContain('rode as migrations')
  })

  it('nunca mostra inglês desconhecido nem [object Object]', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(errorMessage(new Error('Cannot read properties of undefined'))).toBe('Algo deu errado. Tente de novo.')
    expect(errorMessage({})).toBe('Algo deu errado. Tente de novo.')
    expect(errorMessage(null)).toBe('Algo deu errado. Tente de novo.')
  })
})

describe('safeNext', () => {
  it('só aceita caminhos internos', async () => {
    const { safeNext } = await import('./safeNext')
    expect(safeNext('/parties/abc?x=1')).toBe('/parties/abc?x=1')
    expect(safeNext('//evil.com')).toBe('/')
    expect(safeNext('/\\evil.com')).toBe('/')
    expect(safeNext('https://evil.com')).toBe('/')
    expect(safeNext(undefined, '/parties')).toBe('/parties')
  })
})

describe('errorMessage em outros idiomas', () => {
  afterEach(async () => {
    const { i18n } = await import('@/shared/i18n')
    i18n.global.locale.value = 'pt-BR'
  })

  it('traduz mensagens do banco (com valores variáveis) e erros conhecidos', async () => {
    const { i18n } = await import('@/shared/i18n')
    i18n.global.locale.value = 'en'
    expect(errorMessage({ message: 'Ludra requer item level 2800.', code: 'P0001' })).toBe('Ludra requires item level 2800.')
    expect(errorMessage({ message: 'x', code: '42501' })).toBe("You don't have permission to do that.")
    i18n.global.locale.value = 'es'
    expect(errorMessage({ message: 'A party já está completa (8 vagas).', code: 'P0001' })).toBe(
      'La party ya está completa (8 puestos).',
    )
    // Sem tradução conhecida: mostra o original.
    expect(errorMessage({ message: 'Mensagem nova do banco.', code: 'P0001' })).toBe('Mensagem nova do banco.')
  })
})
