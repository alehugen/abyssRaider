import { describe, expect, it, vi } from 'vitest'
import { shareLink } from './shareLink'

const link = { url: 'https://app.test/parties/1', title: 'Os Daevas' }

describe('shareLink', () => {
  it('no celular abre o compartilhar do sistema (WhatsApp, Discord...)', async () => {
    const share = vi.fn(async () => {})
    const writeText = vi.fn(async () => {})
    expect(await shareLink(link, { share, writeText, touch: true })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ url: link.url, title: link.title })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('fechou o compartilhar sem escolher: não copia nem mostra nada', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('cancelado', 'AbortError')
    })
    const writeText = vi.fn(async () => {})
    expect(await shareLink(link, { share, writeText, touch: true })).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('no computador (ou sem compartilhar): copia o link', async () => {
    const writeText = vi.fn(async () => {})
    expect(await shareLink(link, { share: vi.fn(), writeText, touch: false })).toBe('copied')
    expect(await shareLink(link, { writeText, touch: true })).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(link.url)
  })

  it('sem área de transferência: mostra o link para copiar à mão', async () => {
    const prompt = vi.fn()
    const writeText = vi.fn(async () => {
      throw new Error('negado')
    })
    expect(await shareLink(link, { writeText, prompt, touch: false, promptLabel: 'Copie:' })).toBe('prompted')
    expect(prompt).toHaveBeenCalledWith('Copie:', link.url)
  })
})
