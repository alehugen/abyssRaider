<script setup lang="ts">
import AppLayout from '@/app/layouts/AppLayout.vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { useTheme } from '@/shared/presentation/theme/useTheme'

useTheme()
void useAuthStore().init()
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>
