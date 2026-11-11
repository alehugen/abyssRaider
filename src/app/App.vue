<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/app/layouts/AppLayout.vue'
import ConfirmDialog from '@/shared/presentation/confirm/ConfirmDialog.vue'
import { TooltipProvider } from '@/shared/presentation/ui/tooltip'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { useTheme } from '@/shared/presentation/theme/useTheme'

useTheme()
const auth = useAuthStore()
void auth.init()

// Sessão encerrada em outra aba ou expirada: sai da página protegida para o login.
const route = useRoute()
const router = useRouter()
watch(
  () => auth.status,
  (status) => {
    if (status === 'anonymous' && route.meta.requiresAuth) {
      void router.replace({ name: 'login', query: { next: route.fullPath } })
    }
  },
)
</script>

<template>
  <!--
    scroll-body=false: ao travar a rolagem, a reka-ui não soma padding no body.
    O espaço da barra já fica reservado (scrollbar-gutter no main.css).
  -->
  <ConfigProvider :scroll-body="false">
    <TooltipProvider :delay-duration="200">
      <AppLayout>
        <RouterView />
      </AppLayout>
      <ConfirmDialog />
    </TooltipProvider>
  </ConfigProvider>
</template>
