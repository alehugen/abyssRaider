<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/presentation/ui/alert-dialog'
import { buttonVariants } from '@/shared/presentation/ui/button'
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
        <AlertDialogAction
          :class="confirmState.destructive ? buttonVariants({ variant: 'destructive' }) : undefined"
          @click="settleConfirm(true)"
        >
          {{ confirmState.confirmText ?? 'Confirmar' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
