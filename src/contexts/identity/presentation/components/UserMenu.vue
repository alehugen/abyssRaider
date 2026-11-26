<script setup lang="ts">
import { PhBellRinging, PhCaretDown, PhDeviceMobile, PhSignOut, PhSword } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PushSettingsDialog from '@/contexts/notifications/presentation/push/PushSettingsDialog.vue'
import { usePushNotifications } from '@/contexts/notifications/presentation/push/usePushNotifications'
import InstallIosDialog from '@/shared/presentation/pwa/InstallIosDialog.vue'
import { installAction, usePwaInstall } from '@/shared/presentation/pwa/usePwaInstall'
import { userInitials } from '@/contexts/identity/domain/User'
import { t } from '@/shared/i18n'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/presentation/ui/avatar'
import { Button } from '@/shared/presentation/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/presentation/ui/dropdown-menu'
import { useAuthStore } from '../useAuthStore'

const auth = useAuthStore()
const router = useRouter()

/** "Instalar app": convite do navegador ou, no iPhone/iPad, o passo a passo. Some quando já instalado. */
const install = installAction(usePwaInstall())
const iosHelp = ref(false)
async function installApp() {
  if ((await install.run()) === 'manual') iosHelp.value = true
}

/** Push neste aparelho (raids e patch notes). */
const pushSettings = ref(false)

async function signOut() {
  // Antes de sair (precisa da sessão): o aparelho para de receber as notificações desta conta.
  await usePushNotifications().forgetDevice()
  // Vai para a página inicial antes: saindo numa página protegida, o App.vue também
  // redirecionava (para o login) e as duas navegações disputavam.
  await router.push('/')
  await auth.signOut()
}
</script>

<template>
  <DropdownMenu v-if="auth.user">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="h-9 gap-2 px-1.5" :aria-label="t('identity.menu.account', { name: auth.user.displayName })">
        <Avatar class="size-7">
          <AvatarImage v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" :alt="auth.user.displayName" />
          <AvatarFallback class="text-xs font-semibold">{{ userInitials(auth.user) }}</AvatarFallback>
        </Avatar>
        <span class="hidden max-w-32 truncate lg:inline">{{ auth.user.displayName }}</span>
        <PhCaretDown class="hidden text-muted-foreground sm:block" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-60">
      <DropdownMenuLabel class="truncate">{{ auth.user.displayName }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="router.push('/me')">
        <PhSword />
        {{ t('identity.menu.myCharacters') }}
      </DropdownMenuItem>
      <DropdownMenuItem @select="pushSettings = true">
        <PhBellRinging />
        {{ t('notifications.push.menu') }}
      </DropdownMenuItem>
      <DropdownMenuItem v-if="install.visible.value" @select="installApp">
        <PhDeviceMobile />
        {{ t('app.pwa.install.menu') }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" @select="signOut">
        <PhSignOut />
        {{ t('identity.menu.signOut') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <InstallIosDialog v-model:open="iosHelp" />
  <PushSettingsDialog v-model:open="pushSettings" />
</template>
