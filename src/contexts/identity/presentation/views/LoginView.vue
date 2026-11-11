<script setup lang="ts">
import { PhWarningCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/presentation/ui/card'
import DiscordLoginButton from '../components/DiscordLoginButton.vue'
import { safeNext } from '@/shared/lib/safeNext'
import { useAuthStore } from '../useAuthStore'

const route = useRoute()
const auth = useAuthStore()

const next = computed(() => safeNext(route.query.next))
const callbackError = computed(() => (typeof route.query.error === 'string' ? route.query.error : null))
</script>

<template>
  <div class="mx-auto max-w-sm py-12">
    <Card class="faction-asmodian border-t-4 border-faction">
      <CardHeader class="text-center">
        <CardTitle class="font-display text-2xl">Entrar no AbyssRaider</CardTitle>
        <CardDescription>
          Usamos sua conta do Discord para identificar você nas parties e enviar avisos de raid.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <DiscordLoginButton :next="next" size="lg" class="w-full" />
        <p
          v-if="auth.error || callbackError"
          role="alert"
          class="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          <PhWarningCircle :size="18" class="mt-px flex-none" />
          {{ auth.error || callbackError }}
        </p>
        <p class="text-center text-xs text-muted-foreground">
          Pedimos apenas seu nome e avatar do Discord (escopo <code>identify</code>).
        </p>
      </CardContent>
    </Card>
  </div>
</template>
