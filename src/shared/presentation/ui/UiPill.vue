<script setup lang="ts">
/**
 * tone:
 *  - faction: usa a facção do ancestral (.faction-elyos / .faction-asmodian)
 *  - neutral: fundo suave neutro
 *  - solid:   destaque (texto claro sobre foreground)
 */
withDefaults(defineProps<{ tone?: 'faction' | 'neutral' | 'solid'; as?: string }>(), {
  tone: 'neutral',
  as: 'span',
})
</script>

<template>
  <component
    :is="as"
    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] leading-tight font-semibold whitespace-nowrap"
    :class="{
      'bg-faction-soft text-faction-ink': tone === 'faction',
      'bg-surface-muted text-foreground': tone === 'neutral',
      'bg-foreground text-background text-xs': tone === 'solid',
    }"
  >
    <slot />
  </component>
</template>
