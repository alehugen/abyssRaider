<script setup lang="ts">
import { PhSignIn, PhSpiral } from '@phosphor-icons/vue'
import UserMenu from '@/contexts/identity/presentation/components/UserMenu.vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import ThemePicker from '@/shared/presentation/theme/ThemePicker.vue'
import { Button } from '@/shared/presentation/ui/button'

const auth = useAuthStore()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <RouterLink to="/" class="flex items-center gap-2 rounded-md font-display text-xl font-bold">
          <PhSpiral :size="22" weight="duotone" class="text-primary" aria-hidden="true" />
          AbyssRaider
        </RouterLink>
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
