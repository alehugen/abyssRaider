<script setup lang="ts">
import { PhCalendarDots, PhScroll, PhLinkedinLogo, PhSignIn, PhSword, PhUserList, PhUsersThree } from '@phosphor-icons/vue'
import { computed } from 'vue'
import UserMenu from '@/contexts/identity/presentation/components/UserMenu.vue'
import NotificationBell from '@/contexts/notifications/presentation/NotificationBell.vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { t } from '@/shared/i18n'
import ThemePicker from '@/shared/presentation/theme/ThemePicker.vue'
import LanguagePicker from '@/shared/presentation/i18n/LanguagePicker.vue'
import BottomNav from '@/shared/presentation/navigation/BottomNav.vue'
import OfflineBanner from '@/shared/presentation/pwa/OfflineBanner.vue'
import PwaUpdateToast from '@/shared/presentation/pwa/PwaUpdateToast.vue'
import { Button } from '@/shared/presentation/ui/button'

const auth = useAuthStore()

/** `label` é a chave em app.nav.* (traduzida no render). */
const links = [
  { to: '/me', label: 'characters', icon: PhSword },
  { to: '/parties', label: 'parties', icon: PhUsersThree },
  { to: '/jogadores', label: 'players', icon: PhUserList },
  { to: '/agenda', label: 'schedule', icon: PhCalendarDots },
  { to: '/patch-notes', label: 'patchNotes', icon: PhScroll },
] as const

/** No celular a navegação fica na barra inferior; no desktop, no cabeçalho. */
const navItems = computed(() => links.map((l) => ({ ...l, label: t(`app.nav.${l.label}`) })))
/** Barra inferior: nome curto quando o completo não cabe em 360px (o completo fica para leitores de tela). */
const SHORT = new Set<string>(['characters', 'patchNotes'])
const bottomItems = computed(() =>
  links.map((l) => ({
    ...l,
    label: SHORT.has(l.label) ? t(`app.nav.short.${l.label}`) : t(`app.nav.${l.label}`),
    ariaLabel: t(`app.nav.${l.label}`),
  })),
)
</script>

<template>
  <div :class="['flex min-h-dvh flex-col overflow-x-clip', auth.isAuthenticated && 'max-md:pb-nav']">
    <header class="sticky top-0 z-20 border-b bg-background/85 pt-safe backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-safe">
        <RouterLink to="/" class="flex min-h-11 items-center gap-2 rounded-md font-display text-xl font-bold">
          <img src="/aion2-icon.png" alt="" width="30" height="30" class="size-7.5 rounded-md shadow-sm" />
          <span :class="auth.isAuthenticated && 'hidden sm:inline md:hidden lg:inline'">AbyssRaider</span>
        </RouterLink>
        <nav v-if="auth.isAuthenticated" :aria-label="t('app.nav.main')" class="mr-auto ml-4 hidden min-w-0 items-center gap-1 md:flex">
          <RouterLink
            v-for="link in navItems"
            :key="link.to"
            :to="link.to"
            class="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&.router-link-active]:bg-accent [&.router-link-active]:text-foreground"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
        <div class="flex flex-none items-center gap-0.5 sm:gap-1.5">
          <LanguagePicker />
          <ThemePicker />
          <NotificationBell v-if="auth.isAuthenticated" />
          <UserMenu v-if="auth.isAuthenticated" />
          <Button v-else-if="auth.status === 'anonymous'" variant="outline" class="h-10" as-child>
            <RouterLink :to="{ name: 'login' }">
              <PhSignIn />
              <span class="sr-only sm:not-sr-only">{{ t('app.nav.signIn') }}</span>
            </RouterLink>
          </Button>
        </div>
      </div>
      <OfflineBanner />
    </header>
    <main class="mx-auto w-full max-w-6xl flex-1 px-safe py-6 sm:py-8">
      <slot />
    </main>
    <footer class="border-t border-border/60 bg-background/70 backdrop-blur">
      <div
        class="mx-auto flex max-w-6xl flex-col gap-2 px-safe py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-6"
      >
        <p class="max-w-prose">{{ t('app.footer.disclaimer') }}</p>
        <p class="flex flex-none items-center gap-1.5">
          {{ t('app.footer.developedBy') }}
          <a
            href="https://www.linkedin.com/in/alehugen/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center gap-1 rounded font-medium text-foreground hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:min-h-0"
          >
            Alessandro Hugen
            <PhLinkedinLogo :size="16" weight="fill" aria-label="LinkedIn" />
          </a>
        </p>
      </div>
    </footer>
    <BottomNav v-if="auth.isAuthenticated" :label="t('app.nav.main')" :items="bottomItems" />
    <PwaUpdateToast :above-nav="auth.isAuthenticated" />
  </div>
</template>
