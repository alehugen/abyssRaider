<script setup lang="ts">
import { PhMagnifyingGlass } from '@phosphor-icons/vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/presentation/ui/card'
import { useAuthStore } from '../useAuthStore'

const auth = useAuthStore()
</script>

<template>
  <div class="space-y-6">
    <header>
      <p class="text-sm text-muted-foreground">Olá, {{ auth.user?.displayName }}</p>
      <h1 class="font-display text-3xl font-bold">Meus personagens</h1>
    </header>

    <Card class="border-2 border-dashed bg-transparent shadow-none">
      <CardHeader class="items-center text-center">
        <PhMagnifyingGlass :size="32" class="mx-auto text-muted-foreground" />
        <CardTitle>Nenhum personagem vinculado</CardTitle>
        <CardDescription>A busca e o vínculo de personagens chegam na próxima etapa.</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  </div>
</template>
