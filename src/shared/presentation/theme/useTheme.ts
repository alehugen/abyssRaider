import { computed, effectScope, readonly, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  getTheme,
  isThemePreference,
  SYSTEM_THEME,
  THEMES,
  type ThemeDefinition,
  type ThemePreference,
} from './themes'

/** Mantenha em sincronia com o script anti-flash em index.html. */
export const THEME_STORAGE_KEY = 'abyss-raider:theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface ThemeEnvironment {
  storage?: ThemeStorage | null
  mediaQuery?: MediaQueryList | null
  root?: HTMLElement | null
  /** Para sincronizar entre abas (evento `storage`). */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null
}

export interface ThemeController {
  /** O que o usuário escolheu (pode ser "system"). */
  preference: Readonly<Ref<ThemePreference>>
  /** O tema efetivamente aplicado. */
  theme: ComputedRef<ThemeDefinition>
  isDark: ComputedRef<boolean>
  setPreference: (preference: ThemePreference) => void
  /** Próxima opção: elyos -> asmodian -> abyss -> system -> elyos */
  cycle: () => void
  dispose: () => void
}

const PREFERENCES: readonly ThemePreference[] = [...THEMES.map((t) => t.id), 'system']

function readPreference(storage: ThemeStorage | null | undefined): ThemePreference {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function writePreference(storage: ThemeStorage | null | undefined, value: ThemePreference): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // storage indisponível (aba anônima, bloqueado): o tema só não persiste.
  }
}

export function createThemeController(env: ThemeEnvironment = {}): ThemeController {
  const { storage, mediaQuery, root, target } = env
  const scope = effectScope(true)

  const preference = ref<ThemePreference>(readPreference(storage))
  const systemPrefersDark = ref(mediaQuery?.matches ?? false)

  const theme = computed(() => {
    const id = preference.value === 'system' ? SYSTEM_THEME[systemPrefersDark.value ? 'dark' : 'light'] : preference.value
    return getTheme(id)
  })
  const isDark = computed(() => theme.value.scheme === 'dark')

  const onSystemChange = (event: MediaQueryListEvent) => {
    systemPrefersDark.value = event.matches
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    preference.value = isThemePreference(event.newValue) ? event.newValue : 'system'
  }

  mediaQuery?.addEventListener('change', onSystemChange)
  target?.addEventListener('storage', onStorage as EventListener)

  scope.run(() => {
    watch(
      theme,
      (t) => {
        if (!root) return
        root.dataset.theme = t.id
        root.classList.toggle('dark', t.scheme === 'dark')
      },
      { immediate: true },
    )
  })

  const setPreference = (value: ThemePreference) => {
    preference.value = value
    writePreference(storage, value)
  }

  return {
    preference: readonly(preference),
    theme,
    isDark,
    setPreference,
    cycle: () => {
      const next = PREFERENCES[(PREFERENCES.indexOf(preference.value) + 1) % PREFERENCES.length]!
      setPreference(next)
    },
    dispose: () => {
      mediaQuery?.removeEventListener('change', onSystemChange)
      target?.removeEventListener('storage', onStorage as EventListener)
      scope.stop()
    },
  }
}

function browserEnvironment(): ThemeEnvironment {
  if (typeof window === 'undefined') return {}
  let storage: ThemeStorage | null = null
  try {
    storage = window.localStorage
  } catch {
    storage = null
  }
  return {
    storage,
    mediaQuery: window.matchMedia?.(DARK_QUERY) ?? null,
    root: document.documentElement,
    target: window,
  }
}

let instance: ThemeController | null = null

/** Tema global da aplicação (singleton). */
export function useTheme(): ThemeController {
  instance ??= createThemeController(browserEnvironment())
  return instance
}
