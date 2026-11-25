<script setup lang="ts">
import type { PatchItem } from '../../domain/PatchNote'
import PatchTable from './PatchTable.vue'

/** Tópicos do patch, com os subtópicos aninhados (mesma estrutura do site oficial). */
defineProps<{ items: PatchItem[]; depth?: number }>()
</script>

<template>
  <ul :class="depth ? 'mt-1.5 space-y-1.5 border-l border-border/70 pl-4' : 'space-y-2.5'">
    <li
      v-for="(item, i) in items"
      :key="i"
      :class="[depth && !item.label ? 'text-sm text-muted-foreground' : 'leading-relaxed', item.label && i > 0 && 'pt-2']"
    >
      <PatchTable v-if="item.table" :rows="item.table" />
      <span v-else-if="item.label" class="font-semibold text-foreground">{{ item.text }}</span>
      <span
        v-else
        :class="depth ? '' : 'relative pl-4 before:absolute before:top-[0.6em] before:left-0 before:size-1.5 before:rounded-full before:bg-primary'"
      >
        {{ item.text }}
      </span>
      <PatchItemList v-if="item.children.length" :items="item.children" :depth="(depth ?? 0) + 1" />
    </li>
  </ul>
</template>
