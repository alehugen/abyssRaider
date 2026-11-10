<script setup lang="ts">
import { PhSignIn } from '@phosphor-icons/vue'
import UserMenu from '@/contexts/identity/presentation/components/UserMenu.vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import ThemePicker from '@/shared/presentation/theme/ThemePicker.vue'
import { Button } from '@/shared/presentation/ui/button'

const auth = useAuthStore()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <RouterLink to="/" class="font-display text-lg font-bold tracking-wide">
          Abyss<span class="text-primary">Raider</span>
        </RouterLink>
        <div class="flex items-center gap-2">
          <ThemePicker />
          <UserMenu v-if="auth.isAuthenticated" />
          <Button v-else-if="auth.status === 'anonymous'" variant="outline" size="sm" as-child>
            <RouterLink :to="{ name: 'login' }">
              <PhSignIn />
              Entrar
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
