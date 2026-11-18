<script setup lang="ts">
import { ref } from 'vue'
import { t } from '@/shared/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/presentation/ui/dialog'
import AvailabilityForm from './AvailabilityForm.vue'

/** Editor da disponibilidade semanal num diálogo. O slot padrão é o botão que abre. */
const open = ref(false)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">{{ t('scheduling.availability.title') }}</DialogTitle>
        <DialogDescription>{{ t('scheduling.availability.dialogDescription') }}</DialogDescription>
      </DialogHeader>

      <!-- O conteúdo só existe com o diálogo aberto: o formulário começa sempre do que está salvo. -->
      <AvailabilityForm cancelable @saved="open = false" @cancel="open = false" />
    </DialogContent>
  </Dialog>
</template>
