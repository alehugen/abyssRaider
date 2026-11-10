<script setup lang="ts">
import { formatMonth, formatWeekday } from '../format'

defineProps<{ date: Date }>()
</script>

<template>
  <!-- Bloco de data estilo calendário: dia da semana, número e mês. -->
  <span
    class="flex w-14 flex-none flex-col items-center rounded-xl border bg-background/60 py-1.5 leading-none"
    aria-hidden="true"
  >
    <span class="text-[11px] text-muted-foreground">{{ formatWeekday(date) }}</span>
    <span class="my-0.5 font-display text-2xl font-bold">{{ date.getDate() }}</span>
    <span class="text-[11px] text-muted-foreground">{{ formatMonth(date) }}</span>
  </span>
</template>
