<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ name: string; src?: string; size?: 'sm' | 'md'; dimmed?: boolean }>(), {
  size: 'md',
  dimmed: false,
})

const failed = ref(false)
watch(
  () => props.src,
  () => (failed.value = false),
)

const initials = computed(() => props.name.slice(0, 2).toUpperCase())
</script>

<template>
  <div
    class="grid flex-none place-items-center overflow-hidden bg-faction-soft font-display font-bold text-faction-ink"
    :class="[
      size === 'md' ? 'size-18 rounded-[22px] text-2xl sm:size-22 sm:rounded-[28px]' : 'size-12 rounded-2xl text-base',
      dimmed && 'opacity-85 grayscale-[.85]',
    ]"
  >
    <img
      v-if="src && !failed"
      :src="src"
      :alt="`Retrato de ${name}`"
      class="size-full object-cover"
      loading="lazy"
      @error="failed = true"
    />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </div>
</template>
