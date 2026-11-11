<script setup lang="ts">
import { PhCheck, PhQuestion, PhX } from '@phosphor-icons/vue'
import type { Component } from 'vue'
import { cn } from '@/shared/lib/utils'
import { RSVP_LABEL, type RsvpStatus } from '../../domain/RaidEvent'

defineProps<{ status: RsvpStatus | null; disabled?: boolean }>()
const emit = defineEmits<{ respond: [status: RsvpStatus] }>()

const OPTIONS: Array<{ value: RsvpStatus; icon: Component; active: string }> = [
  { value: 'going', icon: PhCheck, active: 'bg-success/15 text-success-ink ring-success/40' },
  { value: 'maybe', icon: PhQuestion, active: 'bg-warning/15 text-warning-ink ring-warning/40' },
  { value: 'declined', icon: PhX, active: 'bg-destructive/15 text-destructive-ink ring-destructive/40' },
]
</script>

<template>
  <div role="radiogroup" aria-label="Sua presença" class="inline-flex gap-1 rounded-lg bg-muted p-1">
    <button
      v-for="o in OPTIONS"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="status === o.value"
      :disabled="disabled"
      :class="
        cn(
          'inline-flex items-center gap-1.5 min-h-8 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60',
          status === o.value && ['ring-1', o.active],
        )
      "
      @click="emit('respond', o.value)"
    >
      <component :is="o.icon" :size="14" weight="bold" aria-hidden="true" />
      {{ RSVP_LABEL[o.value] }}
    </button>
  </div>
</template>
