<script setup lang="ts">
import { ref } from 'vue'
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
        <DialogTitle class="font-display text-2xl">Sua disponibilidade</DialogTitle>
        <DialogDescription>Usamos isso para sugerir o melhor horário de raid para a party.</DialogDescription>
      </DialogHeader>

      <!-- O conteúdo só existe com o diálogo aberto: o formulário começa sempre do que está salvo. -->
      <AvailabilityForm cancelable @saved="open = false" @cancel="open = false" />
    </DialogContent>
  </Dialog>
</template>
