<script setup lang="ts">
import { Button } from '@/shared/presentation/ui/button'
import { Badge } from '@/shared/presentation/ui/badge'
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
    <Button size="lg" disabled class="mt-8 shadow-lg shadow-glow">
      Entrar com Discord
      <Badge variant="secondary">em breve</Badge>
    </Button>
  </section>
</template>
