<script setup lang="ts">
import { t } from '@/shared/i18n'
</script>

<template>
  <section class="py-24 text-center">
    <p class="text-sm font-medium text-primary-ink">404</p>
    <h1 class="mt-2 font-display text-3xl font-bold">{{ t('app.notFound.title') }}</h1>
    <p class="mt-2 text-muted-foreground">{{ t('app.notFound.text') }}</p>
    <RouterLink to="/" class="mt-6 inline-block text-primary-ink underline-offset-4 hover:underline">
      {{ t('app.notFound.home') }}
    </RouterLink>
  </section>
</template>
