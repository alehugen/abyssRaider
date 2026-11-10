import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createThemeController, THEME_STORAGE_KEY } from './useTheme'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  }
}

function fakeMediaQuery(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  return {
    mq: {
      matches,
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    } as unknown as MediaQueryList,
    emit: (value: boolean) => listeners.forEach((fn) => fn({ matches: value } as MediaQueryListEvent)),
  }
}

describe('createThemeController', () => {
  it('em "system" usa Asmodian no SO escuro e Elyos no claro', async () => {
    const root = document.createElement('html')
    const { mq, emit } = fakeMediaQuery(true)
    const theme = createThemeController({ storage: memoryStorage(), mediaQuery: mq, root })

    expect(theme.preference.value).toBe('system')
    expect(theme.theme.value.id).toBe('asmodian')
    expect(root.dataset.theme).toBe('asmodian')
    expect(root.classList.contains('dark')).toBe(true)

    emit(false)
    await nextTick()
    expect(theme.theme.value.id).toBe('elyos')
    expect(root.dataset.theme).toBe('elyos')
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('lê e persiste o tema escolhido', async () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: 'abyss' })
    const root = document.createElement('html')
    const theme = createThemeController({ storage, root })

    expect(theme.theme.value.id).toBe('abyss')
    expect(theme.isDark.value).toBe(true)

    theme.setPreference('elyos')
    await nextTick()
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('elyos')
    expect(root.dataset.theme).toBe('elyos')
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('ignora valor inválido no storage', () => {
    const theme = createThemeController({ storage: memoryStorage({ [THEME_STORAGE_KEY]: 'roxo' }) })
    expect(theme.preference.value).toBe('system')
  })

  it('não quebra quando o storage lança erro', () => {
    const boom = () => {
      throw new Error('blocked')
    }
    const theme = createThemeController({ storage: { getItem: boom, setItem: boom } })
    expect(() => theme.setPreference('abyss')).not.toThrow()
    expect(theme.preference.value).toBe('abyss')
  })

  it('cycle percorre todas as opções', () => {
    const theme = createThemeController({ storage: memoryStorage({ [THEME_STORAGE_KEY]: 'elyos' }) })
    const seen = [theme.preference.value]
    for (let i = 0; i < 4; i++) {
      theme.cycle()
      seen.push(theme.preference.value)
    }
    expect(seen).toEqual(['elyos', 'asmodian', 'abyss', 'system', 'elyos'])
  })
})
