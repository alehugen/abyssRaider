<script setup lang="ts">
import AppLayout from '@/app/layouts/AppLayout.vue'
import { useTheme } from '@/shared/presentation/theme/useTheme'

useTheme()
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>
