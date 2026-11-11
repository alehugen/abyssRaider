<script setup lang="ts">
import { PhCaretDown, PhSignOut, PhSword } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import { userInitials } from '@/contexts/identity/domain/User'
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

async function signOut() {
  await auth.signOut()
  await router.push('/')
}
</script>

<template>
  <DropdownMenu v-if="auth.user">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="h-9 gap-2 px-1.5" :aria-label="`Conta de ${auth.user.displayName}`">
        <Avatar class="size-7">
          <AvatarImage v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" :alt="auth.user.displayName" />
          <AvatarFallback class="text-xs font-semibold">{{ userInitials(auth.user) }}</AvatarFallback>
        </Avatar>
        <span class="hidden max-w-32 truncate lg:inline">{{ auth.user.displayName }}</span>
        <PhCaretDown class="hidden text-muted-foreground sm:block" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuLabel class="truncate">{{ auth.user.displayName }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="router.push('/me')">
        <PhSword />
        Meus personagens
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" @select="signOut">
        <PhSignOut />
        Sair
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
