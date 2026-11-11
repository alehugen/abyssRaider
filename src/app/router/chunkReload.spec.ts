import { describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, reloadOnce } from './chunkReload'

function memory() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe('chunkReload', () => {
  it('reconhece falha ao carregar página de outro deploy', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/AgendaView-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('recarrega no destino uma vez e não entra em loop', () => {
    const storage = memory()
    const navigate = vi.fn()
    expect(reloadOnce('/agenda', { storage, now: 1_000_000, navigate })).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/agenda')
    // falhou de novo logo depois: não recarrega
    expect(reloadOnce('/agenda', { storage, now: 1_005_000, navigate })).toBe(false)
    // bem depois (outro deploy): pode recarregar
    expect(reloadOnce('/agenda', { storage, now: 1_020_000, navigate })).toBe(true)
    expect(navigate).toHaveBeenCalledTimes(2)
  })
})
