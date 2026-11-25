<script setup lang="ts">
import { PhWifiSlash } from '@phosphor-icons/vue'
import { t } from '@/shared/i18n'
import { useOnline } from './useOnline'

/** Aviso fixo e discreto quando o aparelho fica sem internet. */
const { online } = useOnline()
</script>

<template>
  <div
    v-if="!online"
    role="status"
    class="border-b border-warning/40 bg-warning/15 px-safe py-2 text-center text-sm text-foreground"
  >
    <PhWifiSlash class="mr-1.5 inline-block align-[-0.15em] text-warning-ink" aria-hidden="true" />
    {{ t('app.pwa.offline') }}
  </div>
</template>
