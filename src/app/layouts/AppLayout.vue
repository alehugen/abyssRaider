<script setup lang="ts">
import ThemePicker from '@/shared/presentation/theme/ThemePicker.vue'
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <RouterLink to="/" class="font-display text-lg font-bold tracking-wide">
          Abyss<span class="text-primary">Raider</span>
        </RouterLink>
        <ThemePicker />
      </div>
    </header>
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>
  </div>
</template>
