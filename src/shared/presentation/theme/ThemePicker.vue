<script setup lang="ts">
import { THEMES } from './themes'
import { useTheme } from './useTheme'

const { preference, setPreference } = useTheme()
</script>

<template>
  <div role="group" aria-label="Tema" class="inline-flex gap-0.5 rounded-lg border bg-surface-muted p-0.5">
    <button
      v-for="t in THEMES"
      :key="t.id"
      type="button"
      :title="`${t.label}: ${t.description}`"
      :aria-pressed="preference === t.id"
      class="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm"
      @click="setPreference(t.id)"
    >
      <span class="size-3 rounded-full ring-1 ring-foreground/20" :style="{ background: t.swatch }" aria-hidden="true" />
      <span class="hidden sm:inline">{{ t.label }}</span>
      <span class="sr-only sm:hidden">{{ t.label }}</span>
    </button>
    <button
      type="button"
      title="Seguir o sistema (claro: Elyos, escuro: Asmodian)"
      aria-label="Seguir o sistema"
      :aria-pressed="preference === 'system'"
      class="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm"
      @click="setPreference('system')"
    >
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    </button>
  </div>
</template>
