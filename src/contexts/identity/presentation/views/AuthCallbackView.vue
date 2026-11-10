<script setup lang="ts">
import { PhSpinnerGap } from '@phosphor-icons/vue'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../useAuthStore'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function safeNext(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

onMounted(async () => {
  // Erro devolvido pelo Discord/Supabase (ex.: usuário cancelou a autorização).
  const error = route.query.error_description ?? route.query.error
  if (error) {
    await router.replace({ name: 'login', query: { error: String(error) } })
    return
  }

  await auth.init()
  if (auth.isAuthenticated) {
    await router.replace(safeNext(route.query.next))
  } else {
    await router.replace({ name: 'login', query: { error: auth.error ?? 'Não foi possível concluir o login.' } })
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-24 text-muted-foreground">
    <PhSpinnerGap :size="32" class="animate-spin" />
    <p>Conectando com o Discord…</p>
  </div>
</template>
