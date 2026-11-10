<script setup lang="ts">
withDefaults(defineProps<{ as?: string; interactive?: boolean }>(), {
  as: 'div',
  interactive: false,
})
</script>

<template>
  <component
    :is="as"
    class="rounded-[20px] bg-surface shadow-card"
    :class="interactive && 'transition-[box-shadow,translate] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover'"
  >
    <slot />
  </component>
</template>
