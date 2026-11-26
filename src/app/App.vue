<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { onScopeDispose, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/app/layouts/AppLayout.vue'
import ConfirmDialog from '@/shared/presentation/confirm/ConfirmDialog.vue'
import { TooltipProvider } from '@/shared/presentation/ui/tooltip'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { useTheme } from '@/shared/presentation/theme/useTheme'
import { useNotificationsStore } from '@/contexts/notifications/presentation/useNotificationsStore'
import { usePushNotifications } from '@/contexts/notifications/presentation/push/usePushNotifications'
import { currentLocale } from '@/shared/i18n'
import { listenToServiceWorker, setAppBadge } from '@/shared/presentation/pwa/swMessages'

useTheme()
const auth = useAuthStore()
void auth.init()

// Sessão encerrada em outra aba ou expirada: sai da página protegida para o login.
const route = useRoute()
const router = useRouter()

// App instalado: toque na notificação com o app aberto navega sem recarregar; push que
// chegou atualiza o sino na hora; o ícone do app mostra as não lidas.
const notifications = useNotificationsStore()
const push = usePushNotifications()
const stopSw = listenToServiceWorker({
  onOpen: (path) => void router.push(path),
  onPush: () => void notifications.refresh(),
})
onScopeDispose(stopSw)
watch(() => notifications.unread, (n) => setAppBadge(n), { immediate: true })
// Logado (e a cada troca de idioma): o cadastro do push deste aparelho fica em dia.
watch(
  [() => auth.user?.id, currentLocale],
  ([userId]) => {
    if (userId) void push.sync()
  },
  { immediate: true },
)
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
