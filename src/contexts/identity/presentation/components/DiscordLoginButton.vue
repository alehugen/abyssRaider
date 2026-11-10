<script setup lang="ts">
import { PhDiscordLogo } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { Button, type ButtonVariants } from '@/shared/presentation/ui/button'
import { useAuthStore } from '../useAuthStore'

const props = withDefaults(defineProps<{ next?: string; size?: ButtonVariants['size']; label?: string }>(), {
  next: '/',
  size: 'default',
  label: 'Entrar com Discord',
})

const auth = useAuthStore()
const redirecting = ref(false)

async function login() {
  redirecting.value = true
  await auth.signIn(props.next)
  // Se voltou daqui sem redirecionar, houve erro (exibido via auth.error).
  redirecting.value = false
}
</script>

<template>
  <Button
    :size="size"
    :disabled="redirecting"
    class="bg-[#5865F2] text-white hover:bg-[#4752C4]"
    @click="login"
  >
    <PhDiscordLogo weight="fill" :size="size === 'lg' ? 20 : 16" />
    {{ redirecting ? 'Redirecionando…' : label }}
  </Button>
</template>
