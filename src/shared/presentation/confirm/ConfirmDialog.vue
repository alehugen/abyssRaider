<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/presentation/ui/alert-dialog'
import { Button } from '@/shared/presentation/ui/button'
import { confirmState, settleConfirm } from './useConfirm'

/** Fechar por Esc ou clique fora conta como "cancelar". */
function onOpenChange(open: boolean) {
  if (!open && confirmState.open) settleConfirm(false)
}
</script>

<template>
  <AlertDialog :open="confirmState.open" @update:open="onOpenChange">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="font-display text-xl">{{ confirmState.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="confirmState.description">
          {{ confirmState.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="settleConfirm(false)">
          {{ confirmState.cancelText ?? 'Cancelar' }}
        </AlertDialogCancel>
        <!--
          Não usar AlertDialogAction aqui: ele é um "DialogClose" e fecha o diálogo antes
          do nosso clique, e o fechamento conta como cancelar. O Button resolve "sim"
          e o settleConfirm fecha em seguida.
        -->
        <Button :variant="confirmState.destructive ? 'destructive' : 'default'" @click="settleConfirm(true)">
          {{ confirmState.confirmText ?? 'Confirmar' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
