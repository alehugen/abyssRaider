<script setup lang="ts">
import { PhCheck, PhDesktop, PhMoonStars, PhSpiral, PhSun } from '@phosphor-icons/vue'
import { computed, type Component } from 'vue'
import { t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/presentation/ui/dropdown-menu'
import { THEMES, type ThemeId, type ThemePreference } from './themes'
import { useTheme } from './useTheme'

/** Um botão só (cabe no cabeçalho do celular), com o tema atual; o menu tem as opções. */
const { preference, theme, setPreference } = useTheme()

const icons: Record<ThemeId, Component> = {
  elyos: PhSun,
  asmodian: PhMoonStars,
  abyss: PhSpiral,
}

const current = computed(() => (preference.value === 'system' ? t('app.theme.system') : theme.value.label))
const currentIcon = computed(() => (preference.value === 'system' ? PhDesktop : icons[theme.value.id as ThemeId]))
const options = computed<Array<{ value: ThemePreference; label: string; hint: string; icon: Component; color?: string }>>(
  () => [
    ...THEMES.map((th) => ({ value: th.id, label: th.label, hint: th.description, icon: icons[th.id], color: th.swatch })),
    { value: 'system', label: t('app.theme.system'), hint: t('app.theme.systemHint'), icon: PhDesktop },
  ],
)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="size-9"
        :aria-label="t('app.theme.current', { name: current })"
        :title="t('app.theme.current', { name: current })"
      >
        <component
          :is="currentIcon"
          :size="20"
          weight="duotone"
          :color="preference === 'system' ? undefined : theme.swatch"
          aria-hidden="true"
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-60">
      <DropdownMenuLabel>{{ t('app.theme.label') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="o in options"
        :key="o.value"
        class="items-start gap-2.5"
        @select="setPreference(o.value)"
      >
        <component :is="o.icon" :size="18" weight="duotone" :color="o.color" class="mt-0.5" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block font-medium">{{ o.label }}</span>
          <span class="block text-xs text-muted-foreground">{{ o.hint }}</span>
        </span>
        <PhCheck v-if="preference === o.value" class="mt-0.5" aria-hidden="true" />
        <span v-if="preference === o.value" class="sr-only">({{ t('app.theme.selected') }})</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
