<script setup lang="ts">
import { PhDesktop, PhMoonStars, PhSpiral, PhSun } from '@phosphor-icons/vue'
import type { Component } from 'vue'
import { ToggleGroup, ToggleGroupItem } from '@/shared/presentation/ui/toggle-group'
import { isThemePreference, THEMES, type ThemeId } from './themes'
import { useTheme } from './useTheme'

const { preference, setPreference } = useTheme()

const icons: Record<ThemeId, Component> = {
  elyos: PhSun,
  asmodian: PhMoonStars,
  abyss: PhSpiral,
}

function onChange(value: unknown) {
  // Clicar no item já ativo emite vazio; mantemos a escolha atual.
  if (isThemePreference(value)) setPreference(value)
}
</script>

<template>
  <ToggleGroup
    type="single"
    size="sm"
    aria-label="Tema"
    class="rounded-lg border bg-muted p-0.5"
    :model-value="preference"
    @update:model-value="onChange"
  >
    <ToggleGroupItem
      v-for="t in THEMES"
      :key="t.id"
      :value="t.id"
      :title="`${t.label}: ${t.description}`"
      :aria-label="t.label"
      class="group gap-1.5 text-xs data-[state=on]:bg-card data-[state=on]:shadow-sm"
    >
      <component
        :is="icons[t.id]"
        :size="16"
        :weight="preference === t.id ? 'fill' : 'duotone'"
        :color="t.swatch"
        aria-hidden="true"
      />
      <span class="hidden sm:inline">{{ t.label }}</span>
    </ToggleGroupItem>
    <ToggleGroupItem
      value="system"
      title="Seguir o sistema (claro: Elyos, escuro: Asmodian)"
      aria-label="Seguir o sistema"
      class="data-[state=on]:bg-card data-[state=on]:shadow-sm"
    >
      <PhDesktop :size="16" :weight="preference === 'system' ? 'fill' : 'regular'" aria-hidden="true" />
    </ToggleGroupItem>
  </ToggleGroup>
</template>
