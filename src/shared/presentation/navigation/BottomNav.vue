<script setup lang="ts">
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Barra de navegação inferior do celular (some a partir de `md`, onde a navegação
 * fica no cabeçalho). Abas com ícone e nome, alvo de toque de 64px de altura, e
 * respeita a barra de gestos (área segura).
 */
defineProps<{
  label: string
  /** `ariaLabel`: nome completo quando `label` é abreviado. */
  items: ReadonlyArray<{ to: RouteLocationRaw; label: string; ariaLabel?: string; icon: Component }>
}>()
</script>

<template>
  <nav :aria-label="label" class="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-safe backdrop-blur md:hidden">
    <ul class="mx-auto flex h-bottom-nav max-w-lg items-stretch px-safe">
      <li v-for="item in items" :key="String(item.to)" class="min-w-0 flex-1">
        <RouterLink
          :to="item.to"
          :aria-label="item.ariaLabel"
          class="group flex h-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-xs font-medium text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-accent/60 [&.router-link-active]:text-foreground"
        >
          <span
            class="grid h-7 w-12 place-items-center rounded-full transition-colors group-[.router-link-active]:bg-primary/15 group-[.router-link-active]:text-primary-ink"
          >
            <component :is="item.icon" :size="22" aria-hidden="true" class="group-[.router-link-active]:hidden" />
            <component :is="item.icon" :size="22" weight="fill" aria-hidden="true" class="hidden group-[.router-link-active]:block" />
          </span>
          <span class="w-full truncate text-center">{{ item.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
