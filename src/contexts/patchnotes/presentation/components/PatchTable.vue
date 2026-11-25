<script setup lang="ts">
import type { PatchTableCell } from '../../domain/PatchNote'

/** Tabela do patch como no site oficial; rola de lado no celular quando é larga. */
defineProps<{ rows: PatchTableCell[][] }>()
</script>

<template>
  <div class="my-1 max-w-full overflow-x-auto rounded-xl border">
    <table class="w-full border-collapse text-left text-sm text-foreground">
      <tbody>
        <tr v-for="(row, r) in rows" :key="r" class="border-b last:border-b-0">
          <component
            :is="cell.header ? 'th' : 'td'"
            v-for="(cell, c) in row"
            :key="c"
            :rowspan="cell.rowSpan"
            :colspan="cell.colSpan"
            :scope="cell.header ? 'col' : undefined"
            :class="[
              'border-r px-3 py-2 align-top whitespace-pre-line last:border-r-0',
              cell.header ? 'bg-muted/60 font-semibold' : 'font-normal',
            ]"
          >
            {{ cell.text }}
          </component>
        </tr>
      </tbody>
    </table>
  </div>
</template>
