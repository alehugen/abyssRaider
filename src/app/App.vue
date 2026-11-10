<script setup lang="ts">
import AppLayout from '@/app/layouts/AppLayout.vue'
import ConfirmDialog from '@/shared/presentation/confirm/ConfirmDialog.vue'
import { TooltipProvider } from '@/shared/presentation/ui/tooltip'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { useTheme } from '@/shared/presentation/theme/useTheme'

useTheme()
void useAuthStore().init()
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <AppLayout>
      <RouterView />
    </AppLayout>
    <ConfirmDialog />
  </TooltipProvider>
</template>
