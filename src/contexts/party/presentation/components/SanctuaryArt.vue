<script setup lang="ts">
/**
 * Arte do santuário no lado direito de um card, esmaecendo para a esquerda.
 * Entra com fade quando termina de baixar e aproxima no hover do card
 * (o card precisa de `group relative isolate overflow-hidden`).
 */
defineProps<{ src?: string | null }>()
</script>

<template>
  <img
    v-if="src"
    :src="src"
    alt=""
    loading="lazy"
    aria-hidden="true"
    class="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-3/5 object-cover object-[center_25%] opacity-0 mask-l-from-35% mask-l-to-100% transition-[opacity,transform] duration-500 data-loaded:opacity-45 dark:data-loaded:opacity-55 data-loaded:group-hover:scale-105 data-loaded:group-hover:opacity-60"
    @load="($event.target as HTMLImageElement).dataset.loaded = ''"
  />
</template>
