<script setup lang="ts">
import { PhCalendarDots, PhSignIn, PhSpiral, PhSword, PhUsersThree } from '@phosphor-icons/vue'
import UserMenu from '@/contexts/identity/presentation/components/UserMenu.vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import ThemePicker from '@/shared/presentation/theme/ThemePicker.vue'
import { Button } from '@/shared/presentation/ui/button'

const auth = useAuthStore()

const links = [
  { to: '/me', label: 'Personagens', icon: PhSword },
  { to: '/parties', label: 'Parties', icon: PhUsersThree },
  { to: '/agenda', label: 'Agenda', icon: PhCalendarDots },
]
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <RouterLink to="/" class="flex items-center gap-2 rounded-md font-display text-xl font-bold">
          <PhSpiral :size="22" weight="duotone" class="text-primary" aria-hidden="true" />
          <span :class="auth.isAuthenticated && 'hidden sm:inline'">AbyssRaider</span>
        </RouterLink>
        <nav v-if="auth.isAuthenticated" aria-label="Principal" class="mr-auto ml-2 flex items-center gap-1 sm:ml-6">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&.router-link-active]:bg-accent [&.router-link-active]:text-foreground"
          >
            <span class="hidden sm:inline">{{ link.label }}</span>
            <component :is="link.icon" class="sm:hidden" :size="18" :aria-label="link.label" />
          </RouterLink>
        </nav>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <ThemePicker />
          <UserMenu v-if="auth.isAuthenticated" />
          <Button v-else-if="auth.status === 'anonymous'" variant="outline" size="sm" as-child>
            <RouterLink :to="{ name: 'login' }">
              <PhSignIn />
              <span class="sr-only sm:not-sr-only">Entrar</span>
            </RouterLink>
          </Button>
        </div>
      </div>
    </header>
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>
  </div>
</template>
