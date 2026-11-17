<script setup lang="ts">
import { PhCheck, PhTranslate } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { currentLocale, LOCALES, setLocale, t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/presentation/ui/dropdown-menu'

/** Botão do cabeçalho com a sigla do idioma atual; o menu mostra cada idioma no próprio nome. */
const current = computed(() => LOCALES.find((l) => l.id === currentLocale()) ?? LOCALES[0])
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-9 gap-1 px-2 text-xs font-semibold"
        :aria-label="t('common.language.current', { name: current.label })"
        :title="t('common.language.current', { name: current.label })"
      >
        <PhTranslate :size="18" aria-hidden="true" />
        {{ current.short }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-44">
      <DropdownMenuLabel>{{ t('common.language.label') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-for="l in LOCALES" :key="l.id" :lang="l.id" @select="setLocale(l.id)">
        <span class="flex-1">{{ l.label }}</span>
        <PhCheck v-if="l.id === current.id" aria-hidden="true" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
