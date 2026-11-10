<script setup lang="ts">
import { PhSword } from '@phosphor-icons/vue'
import DiscordLoginButton from '@/contexts/identity/presentation/components/DiscordLoginButton.vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { Button } from '@/shared/presentation/ui/button'

const auth = useAuthStore()
</script>

<template>
  <section class="relative mx-auto max-w-2xl py-16 text-center">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-64 max-w-md rounded-full bg-glow blur-3xl"
      aria-hidden="true"
    />
    <h1 class="font-display text-4xl font-bold tracking-wide sm:text-5xl">
      Organize suas raids de <span class="text-primary">Aion 2</span>
    </h1>
    <p class="mt-4 text-lg text-muted-foreground">
      Entre com o Discord, vincule seu personagem, monte sua party e acompanhe o calendário de raids.
    </p>
    <div class="mt-8 flex justify-center">
      <Button v-if="auth.isAuthenticated" size="lg" as-child class="shadow-lg shadow-glow">
        <RouterLink to="/me">
          <PhSword :size="20" />
          Meus personagens
        </RouterLink>
      </Button>
      <DiscordLoginButton v-else-if="auth.status === 'anonymous'" next="/me" size="lg" class="shadow-lg" />
    </div>
  </section>
</template>
